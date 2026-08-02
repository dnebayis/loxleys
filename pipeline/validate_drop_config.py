#!/usr/bin/env python3
"""Fail closed until every commercial SeaDrop publication decision is explicit."""

from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERIFIED_SEADROP = "0x00005ea00ac477b1030ce78506496e8c2de24bf5"


def fail(message: str) -> None:
    raise SystemExit(f"FAIL {message}")


def iso_utc(value: object, field: str) -> datetime:
    if not isinstance(value, str) or not value.endswith("Z"):
        fail(f"{field} must be an ISO-8601 UTC timestamp ending in Z")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        fail(f"{field} is not a valid timestamp")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("config", nargs="?", default="drop-config.json")
    parser.add_argument("--pre-studio", action="store_true", help="validate deploy inputs before a Drop URL exists")
    args = parser.parse_args()
    path = ROOT / args.config
    if not path.exists():
        fail(f"missing {path.name}; copy drop-config.example.json and complete it")
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("chainId") != 4663:
        fail("chainId must be Robinhood Chain mainnet (4663)")
    if str(data.get("seaDropAddress", "")).lower() != VERIFIED_SEADROP:
        fail("seaDropAddress must be the verified Robinhood SeaDrop address")
    if not args.pre_studio and not data.get("openSeaDropUrl"):
        fail("openSeaDropUrl is required after Studio publication")
    team, community, public = data["team"], data["community"], data["public"]
    if data.get("inventoryPolicy") != "shared-global-supply-no-stage-reservations":
        fail("inventoryPolicy must roll all unminted stage capacity into the shared global supply")
    if team.get("wallet", "").lower() != "0x07f7fa43551f5e60bedcb9c381f95b18dc983cfb" or team.get("allocation") != 150:
        fail("team wallet/allocation must be the locked wallet and 150")
    if community.get("allocation") != 808:
        fail("community allocation must be 808")
    allowlist = ROOT / community.get("allowlistFile", "")
    if not allowlist.exists():
        fail("community SeaDrop allowlist is missing")
    with allowlist.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.reader(handle))
    if len(rows) != 396 or any(len(row) != 2 for row in rows) or sum(int(row[1]) for row in rows) != 808:
        fail("community allowlist must be headerless: 396 wallet,limit rows totalling 808")
    windows = {}
    for name, stage in (("team", team), ("community", community), ("public", public)):
        if str(stage.get("priceWei")) != "0":
            fail(f"{name}.priceWei must remain locked to 0 (free mint)")
        start = iso_utc(stage.get("startUtc"), f"{name}.startUtc")
        end = iso_utc(stage.get("endUtc"), f"{name}.endUtc")
        if start >= end:
            fail(f"{name} startUtc must be before endUtc")
        windows[name] = (start, end)
    if windows["team"][1] != windows["community"][0] or windows["community"][1] != windows["public"][0]:
        fail("Team, Community and Public windows must be contiguous with no overlap or gap")
    if public.get("walletLimit") != 1:
        fail("public.walletLimit must remain locked to 1")
    print("PASS drop config is complete and internally consistent")


if __name__ == "__main__":
    main()
