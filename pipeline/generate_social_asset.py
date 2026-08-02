#!/usr/bin/env python3
"""Generate a one-off square social asset with the configured Flux pipeline."""

import argparse
import os
import sys

from PIL import Image, ImageColor

from binarize import binarize_image
from config import FLUX_MODELS
from config import GRID_HEIGHT, GRID_WIDTH, RENDER_BG, RENDER_FG
from generate import _load_env, generate_image_with_flux
from preview import unpack


DEFAULT_PROMPT = (
    "square profile icon source art, one front-facing Robin Hood bust portrait, recognizable "
    "pointed hood and a small bow detail, strict black ink shapes on a pure white background, "
    "monochrome 1-bit pixel art designed to remain readable at exactly 40 by 40 pixels, sparse "
    "pixel density, large connected shapes, strong negative space, no gray, no shading, no "
    "color, no text, no letters, no logo, no watermark, no frame, no border"
)


def render_collection_bitmap(source: bytes, output_path: str, size: int = 1000):
    bitmap = binarize_image(source)
    grid = unpack(bitmap)
    image = Image.new("RGB", (GRID_WIDTH, GRID_HEIGHT), ImageColor.getrgb(RENDER_BG))
    pixels = image.load()
    for y in range(GRID_HEIGHT):
        for x in range(GRID_WIDTH):
            if grid[y][x]:
                pixels[x, y] = ImageColor.getrgb(RENDER_FG)
    image.resize((size, size), Image.Resampling.NEAREST).save(output_path, "PNG")


def main():
    parser = argparse.ArgumentParser(description="Generate a Loxleys social profile asset")
    parser.add_argument("--output", required=True, help="PNG output path")
    parser.add_argument("--model", choices=sorted(FLUX_MODELS), default="dev")
    parser.add_argument("--prompt", default=DEFAULT_PROMPT)
    args = parser.parse_args()

    _load_env()
    if not os.environ.get("REPLICATE_API_TOKEN"):
        print("REPLICATE_API_TOKEN is not configured", file=sys.stderr)
        return 1

    image = generate_image_with_flux(args.prompt, args.model)
    output_path = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    render_collection_bitmap(image, output_path)
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
