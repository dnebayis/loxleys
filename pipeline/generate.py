#!/usr/bin/env python3
"""
Loxleys Art Generation Pipeline

CLI tool to generate monochrome 1-bit pixel-art PFP portraits using Flux Dev,
binarize them to 200-byte bitmaps, and save them with their 8-byte traits.

Usage:
    python generate.py --count 10 --output ./output/
    python generate.py --count 5 --output ./output/ --start-id 11
    python generate.py --count 1 --output ./output/ --type 4  # force alien type
"""

import argparse
import os
import sys
import time
import random
from io import BytesIO
from typing import Optional, Set, Tuple

from config import (
    DEFAULT_FLUX_MODEL,
    FLUX_MODELS,
    FLUX_PARAMS,
    FLUX_MODEL_PARAMS,
    CHARACTER_TYPES,
    MAX_RETRIES,
    BITMAP_BYTES,
)
from binarize import binarize_image
from traits import generate_traits, validate_traits
from trait_names import build_prompt
from output import save_token, load_existing_traits


def _load_env():
    """Populate os.environ from a `.env` file next to this script, if present.
    Existing environment variables win. No external dependency needed."""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key, val = key.strip(), val.strip().strip('"').strip("'")
            if key and val and key not in os.environ:
                os.environ[key] = val


def _import_replicate():
    """Lazy import of replicate and requests (only needed for real generation)."""
    import replicate
    import requests
    return replicate, requests


def generate_image_with_flux(prompt: str, model_key: str) -> bytes:
    """
    Generate an image using Flux Dev via Replicate API.
    
    Args:
        prompt: Text prompt for image generation.
        model_key: Key from config.FLUX_MODELS.
        
    Returns:
        Image bytes (PNG format).
        
    Raises:
        RuntimeError: If Replicate API call fails.
    """
    model = FLUX_MODELS[model_key]
    model_params = FLUX_MODEL_PARAMS.get(model_key, {})
    replicate, requests = _import_replicate()
    try:
        output = replicate.run(
            model,
            input={
                "prompt": prompt,
                **FLUX_PARAMS,
                **model_params,
            },
        )

        # Replicate returns a list of FileOutput objects or URLs
        if isinstance(output, list) and len(output) > 0:
            image_url = str(output[0])
        else:
            image_url = str(output)

        # Download the generated image
        response = requests.get(image_url, timeout=60)
        response.raise_for_status()
        return response.content

    except Exception as e:
        raise RuntimeError(f"Flux Dev generation failed: {e}")


def generate_token(
    token_id: int,
    output_dir: str,
    existing_traits: Set[bytes],
    character_type: Optional[int] = None,
    model_key: str = DEFAULT_FLUX_MODEL,
) -> Tuple[bytes, bytes]:
    """
    Generate a single token: image + traits.
    
    Process:
    1. Assign traits (with uniqueness check)
    2. Determine character type from traits
    3. Generate image via Flux Dev
    4. Binarize image to 200-byte bitmap
    5. Save outputs
    
    Args:
        token_id: Token ID number.
        output_dir: Output directory path.
        existing_traits: Set of existing trait combinations for uniqueness.
        character_type: Optional forced character type (0-3). If None, uses trait[0].
        model_key: Key from config.FLUX_MODELS.
        
    Returns:
        Tuple of (bitmap, traits).
        
    Raises:
        RuntimeError: If generation fails after MAX_RETRIES attempts.
    """
    # Generate unique traits
    seed = token_id * 31337 + int(time.time())
    traits = generate_traits(seed, existing_traits)

    # Optionally force the character type (byte 0)
    if character_type is not None:
        traits = bytes([character_type]) + traits[1:]

    # Build a trait-driven prompt so the portrait matches its traits
    prompt = build_prompt(traits)
    print(f"  Model: {model_key} ({FLUX_MODELS[model_key]})")
    print(f"  Prompt: {prompt}")

    # Generate image with retries
    bitmap = None
    last_error = None

    for attempt in range(MAX_RETRIES):
        try:
            print(f"  [Attempt {attempt + 1}/{MAX_RETRIES}] Generating image...")
            image_bytes = generate_image_with_flux(prompt, model_key)
            bitmap = binarize_image(image_bytes)
            assert len(bitmap) == BITMAP_BYTES
            break
        except Exception as e:
            last_error = e
            print(f"  [Attempt {attempt + 1}/{MAX_RETRIES}] Failed: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 ** attempt)  # exponential backoff

    if bitmap is None:
        raise RuntimeError(
            f"Failed to generate token {token_id} after {MAX_RETRIES} attempts: {last_error}"
        )

    # Save outputs
    save_token(output_dir, token_id, bitmap, traits)
    existing_traits.add(traits)

    return bitmap, traits


def main():
    parser = argparse.ArgumentParser(
        description="Loxleys Art Generation Pipeline — generate monochrome pixel-art PFP portraits"
    )
    parser.add_argument(
        "--count", type=int, required=True,
        help="Number of tokens to generate"
    )
    parser.add_argument(
        "--output", type=str, required=True,
        help="Output directory for generated files"
    )
    parser.add_argument(
        "--start-id", type=int, default=1,
        help="Starting token ID (default: 1)"
    )
    parser.add_argument(
        "--type", type=int, choices=list(range(len(CHARACTER_TYPES))), default=None,
        help="Force character type 0-9 (see config.CHARACTER_TYPES)"
    )
    parser.add_argument(
        "--model", choices=sorted(FLUX_MODELS.keys()), default=DEFAULT_FLUX_MODEL,
        help=f"Replicate Flux model alias (default: {DEFAULT_FLUX_MODEL})"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Skip Flux Dev calls, generate random bitmaps for testing"
    )
    args = parser.parse_args()

    # Validate
    if args.count < 1:
        print("Error: --count must be at least 1")
        sys.exit(1)

    # Load pipeline/.env and check the Replicate token for real generation
    _load_env()
    if not args.dry_run and not os.environ.get("REPLICATE_API_TOKEN"):
        print("Error: REPLICATE_API_TOKEN not set. Add it to pipeline/.env "
              "(see .env.example) or export it, or use --dry-run.")
        sys.exit(1)

    # Load existing traits for uniqueness
    print(f"Loading existing traits from {args.output}...")
    existing_traits = load_existing_traits(args.output)
    print(f"Found {len(existing_traits)} existing trait combinations.")

    # Generate tokens
    success_count = 0
    fail_count = 0

    for i in range(args.count):
        token_id = args.start_id + i
        print(f"\n[{i + 1}/{args.count}] Generating token #{token_id}...")

        try:
            if args.dry_run:
                bitmap, traits = _dry_run_generate(
                    token_id, args.output, existing_traits, args.type
                )
            else:
                bitmap, traits = generate_token(
                    token_id, args.output, existing_traits, args.type, args.model
                )

            print(f"  ✓ Token #{token_id} saved")
            print(f"    Traits: 0x{traits.hex()}")
            pixel_count = sum(
                (b >> bit) & 1
                for b in bitmap
                for bit in range(7, -1, -1)
            )
            print(f"    Foreground pixels: {pixel_count}/1600")
            success_count += 1

        except Exception as e:
            print(f"  ✗ Token #{token_id} failed: {e}")
            fail_count += 1

    # Summary
    print(f"\n{'=' * 40}")
    print(f"Generation complete:")
    print(f"  Success: {success_count}")
    print(f"  Failed:  {fail_count}")
    print(f"  Output:  {os.path.abspath(args.output)}")


def _dry_run_generate(
    token_id: int,
    output_dir: str,
    existing_traits: Set[bytes],
    character_type: Optional[int] = None,
) -> Tuple[bytes, bytes]:
    """Generate a random bitmap for dry-run testing (no API calls)."""
    seed = token_id * 31337 + 42
    traits = generate_traits(seed, existing_traits)

    # Generate random-ish bitmap (seeded for reproducibility)
    rng = random.Random(seed)
    bitmap = bytearray(BITMAP_BYTES)
    for i in range(BITMAP_BYTES):
        bitmap[i] = rng.randint(0, 255)

    bitmap = bytes(bitmap)
    save_token(output_dir, token_id, bitmap, traits)
    existing_traits.add(traits)

    return bitmap, traits


if __name__ == "__main__":
    main()
