#!/usr/bin/env python3
"""Build and validate the manual OpenSea Studio media + metadata package."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

from PIL import Image

from trait_names import LEGENDARY_CHARACTERS, POOLS, apply_legendary_overrides, label

WIDTH = 40
SCALE = 40
SUPPLY = 2000
TRAITS = ["Type", "Gender", "Age", "HairStyle", "FacialFeature", "Eyes", "Expression", "Accessory"]
BACKGROUND = (10, 10, 10)
FOREGROUND = (205, 255, 0)


def bitmap_image(raw: bytes) -> Image.Image:
    if len(raw) != 200:
        raise ValueError(f"bitmap must be 200 bytes, got {len(raw)}")
    image = Image.new("RGB", (WIDTH, WIDTH), BACKGROUND)
    pixels = image.load()
    for bit in range(WIDTH * WIDTH):
        byte, offset = divmod(bit, 8)
        if (raw[byte] >> (7 - offset)) & 1:
            pixels[bit % WIDTH, bit // WIDTH] = FOREGROUND
    return image.resize((WIDTH * SCALE, WIDTH * SCALE), Image.Resampling.NEAREST)


def metadata_row(token_id: int, traits: bytes) -> dict[str, str]:
    normalized = apply_legendary_overrides(token_id, traits)
    legendary = LEGENDARY_CHARACTERS.get(token_id)
    name = legendary[0] if legendary else f"Loxley #{token_id}"
    description = (
        f"{legendary[0]}, a named rare Loxley in the normal mint pool. " if legendary else ""
    ) + "An owner-controlled on-chain pixel agent with an immutable Public identity and one optional Outlaw transformation."
    row = {
        "tokenID": str(token_id),
        "name": name,
        "description": description,
        "file_name": f"{token_id}.png",
        "external_url": "",
    }
    for index, category in enumerate(TRAITS):
        row[f"attributes[{category}]"] = label(category, normalized[index])
    row["attributes[Rarity]"] = "Named Rare" if legendary else ("Rare" if label("Type", normalized[0]) in {"portrait dog", "portrait cat", "alien", "secret agent"} else "Common")
    return row


def build(art_dir: Path, output: Path) -> None:
    images = output / "images"
    images.mkdir(parents=True, exist_ok=True)
    fields = [
        "tokenID", "name", "description", "file_name", "external_url",
        *(f"attributes[{category}]" for category in TRAITS),
        "attributes[Rarity]",
    ]
    rows: list[dict[str, str]] = []
    checksums: list[dict[str, str]] = []
    for token_id in range(1, SUPPLY + 1):
        bitmap_path = art_dir / f"{token_id}.bin"
        traits_path = art_dir / f"{token_id}.traits"
        raw = bitmap_path.read_bytes()
        traits_hex = traits_path.read_text().strip()
        traits = bytes.fromhex(traits_hex.removeprefix("0x"))
        if len(traits) != 8:
            raise ValueError(f"{traits_path}: expected 8 bytes")
        for index, category in enumerate(TRAITS):
            if traits[index] >= len(POOLS[category]):
                raise ValueError(f"{traits_path}: invalid {category} value {traits[index]}")
        image_path = images / f"{token_id}.png"
        if not image_path.exists():
            bitmap_image(raw).save(image_path, format="PNG", optimize=True)
        rows.append(metadata_row(token_id, traits))
        checksums.append({
            "tokenID": str(token_id),
            "bitmapSha256": hashlib.sha256(raw).hexdigest(),
            "traitsSha256": hashlib.sha256(traits).hexdigest(),
            "imageSha256": hashlib.sha256(image_path.read_bytes()).hexdigest(),
        })

    with (output / "metadata.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    with (output / "checksums.json").open("w", encoding="utf-8") as handle:
        json.dump({"supply": SUPPLY, "imageSize": [1600, 1600], "items": checksums}, handle, indent=2)

    validate(output)


def validate(output: Path) -> None:
    images = sorted((output / "images").glob("*.png"), key=lambda path: int(path.stem))
    if len(images) != SUPPLY or [int(path.stem) for path in images] != list(range(1, SUPPLY + 1)):
        raise ValueError("images must be named 1.png through 2000.png")
    allowed = {BACKGROUND, FOREGROUND}
    for path in images:
        with Image.open(path) as image:
            if image.size != (1600, 1600) or image.mode != "RGB":
                raise ValueError(f"{path}: invalid image mode or dimensions")
            colors = {color for _, color in (image.getcolors(maxcolors=3) or [])}
            if not colors or colors - allowed:
                raise ValueError(f"{path}: unexpected color")
    with (output / "metadata.csv").open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    expected_files = {f"{token_id}.png" for token_id in range(1, SUPPLY + 1)}
    if len(rows) != SUPPLY or {row.get("file_name") for row in rows} != expected_files:
        raise ValueError("metadata must map each file_name from 1.png through 2000.png exactly once")
    if {row.get("tokenID") for row in rows} != {str(token_id) for token_id in range(1, SUPPLY + 1)}:
        raise ValueError("metadata must contain each tokenID from 1 through 2000 exactly once")
    if any(row["file_name"] != f'{row["tokenID"]}.png' for row in rows):
        raise ValueError("file_name and tokenID must match on every metadata row")
    if sum(row["attributes[Rarity]"] == "Named Rare" for row in rows) != 10:
        raise ValueError("metadata must contain ten named rare items")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--art-dir", type=Path, default=Path(__file__).resolve().parents[1] / "contracts" / "art")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "opensea-drop")
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    validate(args.output) if args.validate_only else build(args.art_dir, args.output)
    print(f"OpenSea media package valid: {args.output}")


if __name__ == "__main__":
    main()
