#!/usr/bin/env python3
"""Audit finalized Loxleys art and trait payloads without mutating files."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from config import BITMAP_BYTES, MAX_SUPPLY, TRAIT_CATEGORIES


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def parse_traits(raw: str) -> bytes | None:
    if len(raw) != 18 or not raw.startswith("0x"):
        return None
    try:
        value = bytes.fromhex(raw[2:])
    except ValueError:
        return None
    return value if len(value) == 8 else None


def audit(source_dir: Path, deploy_dir: Path) -> dict:
    summary = {
        "source_dir": str(source_dir),
        "deploy_dir": str(deploy_dir),
        "expected_supply": MAX_SUPPLY,
        "bitmap_bytes": BITMAP_BYTES,
        "deploy_bins": 0,
        "deploy_traits": 0,
        "missing": [],
        "bad_bin_size": [],
        "bad_trait_format": [],
        "out_of_range_traits": [],
        "expected_source_trait_diffs": [],
        "unexpected_source_trait_diffs": [],
        "source_bitmap_diffs": [],
    }

    for token_id in range(1, MAX_SUPPLY + 1):
        deploy_bin = deploy_dir / f"{token_id}.bin"
        deploy_traits = deploy_dir / f"{token_id}.traits"
        source_bin = source_dir / f"{token_id}.bin"
        source_traits = source_dir / f"{token_id}.traits"

        if not deploy_bin.exists() or not deploy_traits.exists():
            summary["missing"].append(token_id)
            continue

        summary["deploy_bins"] += 1
        summary["deploy_traits"] += 1

        size = deploy_bin.stat().st_size
        if size != BITMAP_BYTES:
            summary["bad_bin_size"].append({"tokenId": token_id, "size": size})

        deploy_raw = read_text(deploy_traits)
        deploy_bytes = parse_traits(deploy_raw)
        if deploy_bytes is None:
            summary["bad_trait_format"].append({"tokenId": token_id, "value": deploy_raw})
            continue

        for index, (name, max_value) in enumerate(TRAIT_CATEGORIES):
            value = deploy_bytes[index]
            if value > max_value:
                summary["out_of_range_traits"].append(
                    {"tokenId": token_id, "trait": name, "value": value, "max": max_value}
                )

        if source_traits.exists():
            source_raw = read_text(source_traits)
            if source_raw.lower() != deploy_raw.lower():
                diff = {"tokenId": token_id, "source": source_raw, "deploy": deploy_raw}
                source_bytes = parse_traits(source_raw)
                if (
                    source_bytes is not None
                    and 1991 <= token_id <= 2000
                    and source_bytes[0] == deploy_bytes[0]
                    and source_bytes[2:] == deploy_bytes[2:]
                ):
                    summary["expected_source_trait_diffs"].append(diff)
                else:
                    summary["unexpected_source_trait_diffs"].append(diff)

        if source_bin.exists() and sha256(source_bin) != sha256(deploy_bin):
            summary["source_bitmap_diffs"].append(token_id)

    summary["ok"] = all(
        len(summary[key]) == 0
        for key in (
            "missing",
            "bad_bin_size",
            "bad_trait_format",
            "out_of_range_traits",
            "unexpected_source_trait_diffs",
            "source_bitmap_diffs",
        )
    )
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit Loxleys deploy art and trait payloads.")
    parser.add_argument("--source-dir", default="pipeline/output-klein-2k")
    parser.add_argument("--deploy-dir", default="contracts/art")
    parser.add_argument("--json-out", help="Optional path for a JSON audit report.")
    args = parser.parse_args()

    report = audit(Path(args.source_dir), Path(args.deploy_dir))
    print(json.dumps(report, indent=2))

    if args.json_out:
        Path(args.json_out).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    if not report["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
