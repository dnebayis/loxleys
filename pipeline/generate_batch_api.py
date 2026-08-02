#!/usr/bin/env python3
"""Production batch generator using Replicate's prediction API.

This avoids `replicate.run()`'s opaque wait loop and makes long batches resumable:
completed `{tokenId}.bin` + `{tokenId}.traits` pairs are skipped on rerun.
"""

import argparse
import json
import os
import random
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional

import requests

from binarize import binarize_image
from config import (
    DEFAULT_FLUX_MODEL,
    FLUX_MODEL_PARAMS,
    FLUX_MODELS,
    FLUX_PARAMS,
    TRAIT_CATEGORIES,
    TYPE_WEIGHTS,
)
from output import load_existing_traits, save_token
from quality import inspect_bitmap
from trait_names import apply_legendary_overrides, build_prompt, label, legendary_prompt
from traits import hex_to_traits, traits_to_hex


LOG_LOCK = threading.Lock()


def load_env() -> None:
    env_path = Path(__file__).with_name(".env")
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def log_event(output_dir: str, event: dict) -> None:
    event = {"ts": time.time(), **event}
    with LOG_LOCK:
        with open(os.path.join(output_dir, "generation-manifest.jsonl"), "a") as f:
            f.write(json.dumps(event, sort_keys=True) + "\n")


def request_with_retry(
    method: str,
    url: str,
    headers: dict,
    *,
    timeout: int,
    retries: int,
    **kwargs,
) -> requests.Response:
    last_error: Optional[Exception] = None
    for attempt in range(1, retries + 1):
        try:
            response = requests.request(
                method,
                url,
                headers=headers,
                timeout=timeout,
                **kwargs,
            )
            response.raise_for_status()
            return response
        except Exception as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(min(2 ** attempt, 12))
    raise RuntimeError(f"{method} {url} failed after {retries} attempts: {last_error}")


def deterministic_traits(token_id: int, existing: set[bytes], seed_salt: int) -> bytes:
    """Generate unique traits without time-based entropy for production reruns."""
    for attempt in range(1024):
        rng = random.Random((token_id * 31337) + seed_salt + attempt)
        trait_bytes = bytearray(8)
        for i, (name, max_val) in enumerate(TRAIT_CATEGORIES):
            if name == "Type":
                trait_bytes[i] = rng.choices(
                    range(max_val + 1),
                    weights=TYPE_WEIGHTS,
                    k=1,
                )[0]
            else:
                trait_bytes[i] = rng.randint(0, max_val)
        traits = bytes(trait_bytes)
        if traits not in existing:
            existing.add(traits)
            return traits
    raise RuntimeError(f"Could not generate unique traits for token {token_id}")


def traits_for_token(token_id: int, output_dir: str, existing: set[bytes], seed_salt: int) -> bytes:
    traits_path = os.path.join(output_dir, f"{token_id}.traits")
    if os.path.exists(traits_path):
        traits = hex_to_traits(Path(traits_path).read_text().strip())
        normalized = apply_legendary_overrides(token_id, traits)
        if normalized != traits:
            Path(traits_path).write_text(traits_to_hex(normalized) + "\n")
        return normalized
    return apply_legendary_overrides(token_id, deterministic_traits(token_id, existing, seed_salt))


def create_prediction(prompt: str, model_key: str, headers: dict, retries: int) -> dict:
    owner, model = FLUX_MODELS[model_key].split("/")
    url = f"https://api.replicate.com/v1/models/{owner}/{model}/predictions"
    body = {
        "input": {
            "prompt": prompt,
            **FLUX_PARAMS,
            **FLUX_MODEL_PARAMS.get(model_key, {}),
        }
    }
    return request_with_retry(
        "POST",
        url,
        headers,
        json=body,
        timeout=45,
        retries=retries,
    ).json()


def poll_prediction(
    prediction: dict,
    headers: dict,
    *,
    poll_interval: int,
    max_wait: int,
    retries: int,
) -> dict:
    deadline = time.time() + max_wait
    while time.time() < deadline:
        time.sleep(poll_interval)
        prediction = request_with_retry(
            "GET",
            prediction["urls"]["get"],
            headers,
            timeout=35,
            retries=retries,
        ).json()
        status = prediction.get("status")
        if status in {"succeeded", "failed", "canceled"}:
            return prediction
    cancel_url = prediction.get("urls", {}).get("cancel")
    if cancel_url:
        try:
            request_with_retry(
                "POST",
                cancel_url,
                headers,
                timeout=30,
                retries=2,
            )
        except Exception:
            pass
    raise TimeoutError(f"Prediction {prediction.get('id')} did not finish in {max_wait}s")


def download_image(image_url: str, headers: dict, retries: int) -> bytes:
    # Replicate delivery URLs do not require auth, but the header is harmless.
    return request_with_retry(
        "GET",
        image_url,
        headers,
        timeout=90,
        retries=retries,
    ).content


def generate_one(
    token_id: int,
    traits: bytes,
    args: argparse.Namespace,
    headers: dict,
) -> tuple[int, bool, str]:
    bitmap_path = os.path.join(args.output, f"{token_id}.bin")
    traits_path = os.path.join(args.output, f"{token_id}.traits")
    quality_hint = ""
    if os.path.exists(bitmap_path) and os.path.exists(traits_path):
        current_quality = inspect_bitmap(Path(bitmap_path).read_bytes())
        if current_quality.accepted:
            return token_id, True, "skipped"
        quality_hint = quality_prompt_hint(current_quality.reason)

    base_prompt = legendary_prompt(token_id) or build_prompt(traits)
    for attempt in range(1, args.prediction_retries + 1):
        try:
            prompt = base_prompt + quality_hint
            prediction = create_prediction(prompt, args.model, headers, args.http_retries)
            log_event(
                args.output,
                {
                    "event": "prediction_created",
                    "token_id": token_id,
                    "attempt": attempt,
                    "model": args.model,
                    "prediction_id": prediction.get("id"),
                    "traits": traits_to_hex(traits),
                    "type": label("Type", traits[0]),
                    "legendary": bool(legendary_prompt(token_id)),
                    "prompt": prompt,
                },
            )
            prediction = poll_prediction(
                prediction,
                headers,
                poll_interval=args.poll_interval,
                max_wait=args.max_wait,
                retries=args.http_retries,
            )
            if prediction.get("status") != "succeeded":
                log_event(
                    args.output,
                    {
                        "event": "prediction_failed",
                        "token_id": token_id,
                        "attempt": attempt,
                        "prediction_id": prediction.get("id"),
                        "error": prediction.get("error") or prediction.get("status"),
                    },
                )
                continue

            output = prediction.get("output")
            image_url = output[0] if isinstance(output, list) else output
            image_bytes = download_image(image_url, headers, args.http_retries)
            bitmap = binarize_image(image_bytes)
            quality = inspect_bitmap(bitmap)
            if not quality.accepted:
                quality_hint = quality_prompt_hint(quality.reason)
                log_event(
                    args.output,
                    {
                        "event": "quality_rejected",
                        "token_id": token_id,
                        "attempt": attempt,
                        "prediction_id": prediction.get("id"),
                        "reason": quality.reason,
                        "foreground_pixels": quality.foreground_pixels,
                        "interior_detail_pixels": quality.interior_detail_pixels,
                    },
                )
                continue
            save_token(args.output, token_id, bitmap, traits)
            pixel_count = quality.foreground_pixels
            log_event(
                args.output,
                {
                    "event": "token_saved",
                    "token_id": token_id,
                    "attempt": attempt,
                    "prediction_id": prediction.get("id"),
                    "traits": traits_to_hex(traits),
                    "foreground_pixels": pixel_count,
                },
            )
            return token_id, True, f"saved {pixel_count}/1600"
        except Exception as exc:
            log_event(
                args.output,
                {
                    "event": "token_error",
                    "token_id": token_id,
                    "attempt": attempt,
                    "error": str(exc),
                },
            )
            if attempt < args.prediction_retries:
                time.sleep(min(2 ** attempt, 20))

    return token_id, False, "failed"


def quality_prompt_hint(reason: str) -> str:
    if reason in {"foreground_too_dense", "insufficient_internal_detail"}:
        return (
            ", quality correction: use much less black ink, mostly pure white canvas, "
            "clear white negative space inside the hood and face, visible eyes mouth and face contours, "
            "thin separated facial details that remain readable at 40 by 40 pixels, "
            "narrow shoulders, thin outer contour, unfilled clothing, no large solid black areas"
        )
    if reason == "foreground_too_sparse":
        return (
            ", quality correction: use a larger connected black head-and-shoulders silhouette, "
            "thicker black shapes, character fills the central sixty percent of the canvas"
        )
    return ""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a resumable Replicate art batch")
    parser.add_argument("--count", type=int, default=0)
    parser.add_argument("--output", required=True)
    parser.add_argument("--start-id", type=int, default=1)
    parser.add_argument("--token-ids-file", help="Optional newline-separated token IDs; overrides count/start-id")
    parser.add_argument("--existing-traits-dir", action="append", default=[], help="Include another collection directory in trait uniqueness checks")
    parser.add_argument("--model", choices=sorted(FLUX_MODELS.keys()), default=DEFAULT_FLUX_MODEL)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--seed-salt", type=int, default=0)
    parser.add_argument("--poll-interval", type=int, default=5)
    parser.add_argument("--max-wait", type=int, default=480)
    parser.add_argument("--prediction-retries", type=int, default=3)
    parser.add_argument("--http-retries", type=int, default=4)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.token_ids_file and args.count < 1:
        raise SystemExit("--count must be at least 1 when --token-ids-file is not used")
    if args.workers < 1:
        raise SystemExit("--workers must be at least 1")

    load_env()
    api_token = os.environ.get("REPLICATE_API_TOKEN")
    if not api_token:
        raise SystemExit("REPLICATE_API_TOKEN not set")

    os.makedirs(args.output, exist_ok=True)
    headers = {
        "Authorization": f"Token {api_token}",
        "Content-Type": "application/json",
    }

    existing = load_existing_traits(args.output)
    for existing_dir in args.existing_traits_dir:
        existing.update(load_existing_traits(existing_dir))
    if args.token_ids_file:
        token_ids = [int(line.strip()) for line in Path(args.token_ids_file).read_text().splitlines() if line.strip()]
    else:
        token_ids = list(range(args.start_id, args.start_id + args.count))
    traits_by_id: dict[int, bytes] = {}
    for token_id in token_ids:
        traits_by_id[token_id] = traits_for_token(token_id, args.output, existing, args.seed_salt)

    print(
        f"Generating {len(token_ids)} tokens to {os.path.abspath(args.output)} "
        f"with {args.model} ({FLUX_MODELS[args.model]}), workers={args.workers}"
    )

    ok = 0
    failed = 0
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(generate_one, token_id, traits_by_id[token_id], args, headers): token_id
            for token_id in token_ids
        }
        for future in as_completed(futures):
            token_id, success, message = future.result()
            if success:
                ok += 1
            else:
                failed += 1
            print(f"#{token_id}: {message} (ok={ok}, failed={failed})", flush=True)

    print(f"Done. Success={ok}, failed={failed}, output={os.path.abspath(args.output)}")


if __name__ == "__main__":
    main()
