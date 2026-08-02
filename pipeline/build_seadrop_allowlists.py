#!/usr/bin/env python3
"""Build OpenSea SeaDrop's headerless wallet,custom_limit allowlists."""

from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DROP = ROOT / "opensea-drop"
TEAM_WALLET = "0x07f7fa43551f5e60bedcb9c381f95b18dc983cfb"


def main() -> None:
    source = DROP / "community-eligible-wallets.csv"
    with source.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    parsed = [(row["address"].lower(), int(row["max_mint"])) for row in rows]
    addresses = [address for address, _ in parsed]
    if len(parsed) != 396 or len(set(addresses)) != len(addresses):
        raise SystemExit("community allowlist must contain exactly 396 unique wallets")
    if any(limit not in {2, 4, 6, 8} for _, limit in parsed):
        raise SystemExit("community custom limits must be 2, 4, 6, or 8")
    if sum(limit for _, limit in parsed) != 808:
        raise SystemExit("community allocation must total 808")

    with (DROP / "community-allowlist-opensea.csv").open("w", newline="", encoding="utf-8") as handle:
        csv.writer(handle, lineterminator="\n").writerows(parsed)
    with (DROP / "team-allowlist-opensea.csv").open("w", newline="", encoding="utf-8") as handle:
        csv.writer(handle, lineterminator="\n").writerow((TEAM_WALLET, 150))

    print("PASS community: 396 unique wallets, allocation 808")
    print("PASS team: 1 wallet, allocation 150")


if __name__ == "__main__":
    main()
