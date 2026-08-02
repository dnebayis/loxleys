#!/usr/bin/env python3
"""Audit generated bitmaps and optionally emit rejected token IDs."""

import argparse
from pathlib import Path

from quality import inspect_bitmap


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit Loxleys bitmap density")
    parser.add_argument("--dir", required=True)
    parser.add_argument("--ids-out")
    args = parser.parse_args()

    root = Path(args.dir)
    rejected = []
    accepted = 0
    for bitmap_path in sorted(root.glob("*.bin"), key=lambda path: int(path.stem)):
        quality = inspect_bitmap(bitmap_path.read_bytes())
        if quality.accepted:
            accepted += 1
        else:
            rejected.append((int(bitmap_path.stem), quality))

    if args.ids_out:
        output = Path(args.ids_out)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text("\n".join(str(token_id) for token_id, _ in rejected) + ("\n" if rejected else ""))

    print(f"accepted={accepted} rejected={len(rejected)} total={accepted + len(rejected)}")
    for token_id, quality in rejected:
        print(f"#{token_id}: {quality.reason} (foreground={quality.foreground_pixels}, detail={quality.interior_detail_pixels})")
    return 1 if rejected else 0


if __name__ == "__main__":
    raise SystemExit(main())
