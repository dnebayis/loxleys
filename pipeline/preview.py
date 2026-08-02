#!/usr/bin/env python3
"""
Preview generated Loxleys bitmaps the way they will render on-chain:
black canvas, flat phosphor-green art (no depth).

Usage:
    python preview.py --dir ./output/ --out preview.png
    python preview.py --dir ./output/ --out preview.png --cols 6 --scale 10
"""
import argparse
import glob
import os

from config import GRID_WIDTH as W, GRID_HEIGHT as H, BITMAP_BYTES, RENDER_BG, RENDER_FG


def _hex(c):
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def unpack(bitmap: bytes):
    """200-byte bitmap -> 40x40 list of 0/1 (MSB-first, row-major)."""
    g = [[0] * W for _ in range(H)]
    for i in range(W * H):
        if (bitmap[i >> 3] >> (7 - (i & 7))) & 1:
            g[i // W][i % W] = 1
    return g


def render_cell(draw, g, ox, oy, scale):
    bg, fg = _hex(RENDER_BG), _hex(RENDER_FG)
    draw.rectangle([ox, oy, ox + W * scale - 1, oy + H * scale - 1], fill=bg)
    # flat green fill — no depth
    for y in range(H):
        for x in range(W):
            if g[y][x]:
                draw.rectangle([ox + x * scale, oy + y * scale,
                                ox + x * scale + scale - 1, oy + y * scale + scale - 1], fill=fg)


def main():
    from PIL import Image, ImageDraw
    ap = argparse.ArgumentParser(description="Preview Loxleys .bin bitmaps (white/green/depth)")
    ap.add_argument("--dir", required=True, help="Directory of .bin files")
    ap.add_argument("--out", default="preview.png", help="Output PNG path")
    ap.add_argument("--cols", type=int, default=5)
    ap.add_argument("--scale", type=int, default=11)
    ap.add_argument("--pad", type=int, default=0)
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(args.dir, "*.bin")),
                   key=lambda p: int(os.path.splitext(os.path.basename(p))[0]) if os.path.splitext(os.path.basename(p))[0].isdigit() else 0)
    if not files:
        print(f"No .bin files in {args.dir}")
        return

    scale, pad, cols = args.scale, args.pad, args.cols
    cell = W * scale + pad * 2
    rows = (len(files) + cols - 1) // cols
    img = Image.new("RGB", (cols * cell, rows * cell), _hex(RENDER_BG))
    d = ImageDraw.Draw(img)
    for i, f in enumerate(files):
        with open(f, "rb") as fh:
            bitmap = fh.read()
        if len(bitmap) != BITMAP_BYTES:
            print(f"skip {f}: {len(bitmap)} bytes")
            continue
        ox = (i % cols) * cell + pad
        oy = (i // cols) * cell + pad
        render_cell(d, unpack(bitmap), ox, oy, scale)
    img.save(args.out)
    print(f"wrote {args.out} ({len(files)} tokens)")


if __name__ == "__main__":
    main()
