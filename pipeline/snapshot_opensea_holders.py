#!/usr/bin/env python3
"""Create a reproducible top-holder allowlist from OpenSea's official API."""

from __future__ import annotations

import csv
import hashlib
import json
import os
import time
import urllib.parse
import urllib.request
import urllib.error
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

COLLECTIONS = ["onchainhoodies-", "stonkbrokers-434284142", "normies", "booa"]
MANUAL_ALLOWLIST = {
    "0x0874ccdf28e1299db8ac8d71241a59c9b7c76b85": 2,
    "0xbf45085ffd464e5b2ea41c2f66f0287384aabb18": 2,
    "0x77d3b6281087e64a68e46018e246780adb7714e8": 2,
    "0xd1dff2fa2a8022ebcfe69715e66b35d16b8f7e4f": 2,
}
API = "https://api.opensea.io/api/v2"
RPC = "https://rpc.mainnet.chain.robinhood.com"
EXCLUDED = {"0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dead"}


def request_json(url: str, api_key: str | None = None, body: dict | list | None = None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"accept": "application/json", "user-agent": "loxleys-drop-builder/1.0"}
    if api_key:
        headers["x-api-key"] = api_key
    if data:
        headers["content-type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers)
    for attempt in range(7):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == 6:
                raise
            time.sleep(0.5 * (2 ** attempt))
        except (urllib.error.URLError, TimeoutError):
            if attempt == 6:
                raise
            time.sleep(0.5 * (2 ** attempt))


def addresses_with_code(addresses: list[str], block: str) -> set[str]:
    result: set[str] = set()
    for start in range(0, len(addresses), 20):
        chunk = addresses[start:start + 20]
        payload = request_json(RPC, body=[
            {"jsonrpc": "2.0", "id": index, "method": "eth_getCode", "params": [address, block]}
            for index, address in enumerate(chunk)
        ])
        by_id = {item["id"]: item.get("result", "0x") for item in payload}
        result.update(address for index, address in enumerate(chunk) if by_id.get(index, "0x") != "0x")
        time.sleep(0.15)
    return result


def holder_address(holder: dict) -> str:
    value = holder.get("address") or holder.get("owner") or holder.get("wallet") or ""
    if isinstance(value, dict):
        value = value.get("address", "")
    return str(value).lower()


def holder_quantity(holder: dict) -> int:
    return int(holder.get("quantity") or holder.get("count") or holder.get("owned_count") or holder.get("num_owned") or 0)


def fetch_holders(slug: str, api_key: str) -> list[dict]:
    rows: list[dict] = []
    seen: set[str] = set()
    cursor: str | None = None
    while True:
        params = {"limit": "200"}
        if cursor:
            params["cursor"] = cursor
        payload = request_json(f"{API}/collections/{slug}/holders?{urllib.parse.urlencode(params)}", api_key)
        page = payload.get("holders") or payload.get("items") or []
        added = 0
        for holder in page:
            address = holder_address(holder)
            if address and address not in seen:
                seen.add(address)
                rows.append(holder)
                added += 1
        if len(rows) >= 500:
            return rows[:500]
        cursor = payload.get("next") or payload.get("next_value")
        if isinstance(cursor, dict):
            cursor = cursor.get("value")
        if not cursor or not page or added == 0:
            return rows
        time.sleep(0.12)


def write_csv(path: Path, fields: list[str], rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    key = os.environ.get("OPENSEA_API_KEY")
    if not key:
        raise SystemExit("OPENSEA_API_KEY is required; never put it in the repository")
    output = Path(os.environ.get("OPENSEA_DROP_DIR", Path(__file__).resolve().parents[1] / "opensea-drop"))
    output.mkdir(parents=True, exist_ok=True)
    latest = request_json(RPC, body={"jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": []})["result"]
    block_number = int(latest, 16)
    taken_at = datetime.now(timezone.utc).isoformat()
    allocation: dict[str, int] = defaultdict(int)
    memberships: dict[str, list[str]] = defaultdict(list)
    sources: list[dict] = []
    per_collection: dict[str, list[dict]] = {}

    for slug in COLLECTIONS:
        candidates = []
        for holder in fetch_holders(slug, key):
            address = holder_address(holder)
            quantity = holder_quantity(holder)
            if len(address) != 42 or address in EXCLUDED or quantity <= 0:
                continue
            candidates.append({"address": address, "quantity": quantity})
        candidates.sort(key=lambda row: (-row["quantity"], row["address"]))
        candidates = candidates[:500]
        contract_addresses = addresses_with_code([row["address"] for row in candidates], latest)
        eligible = []
        for candidate in candidates:
            if candidate["address"] in contract_addresses:
                continue
            eligible.append({**candidate, "rank": len(eligible) + 1, "allocation": 2})
            if len(eligible) == 100:
                break
        if len(eligible) != 100:
            raise RuntimeError(f"{slug}: only {len(eligible)} eligible EOA holders")
        per_collection[slug] = eligible
        write_csv(output / f"holders-{slug.rstrip('-')}.csv", ["rank", "address", "quantity", "allocation"], eligible)
        for row in eligible:
            allocation[row["address"]] += 2
            memberships[row["address"]].append(slug)
        sources.append({"collection": slug, "snapshotBlock": block_number, "snapshotAt": taken_at, "eligibleHolders": 100, "allocation": 200})

    for address, amount in MANUAL_ALLOWLIST.items():
        allocation[address] += amount
        memberships[address].append("manual")

    merged = [{"address": address, "max_mint": amount, "collections": "|".join(memberships[address])} for address, amount in allocation.items()]
    merged.sort(key=lambda row: row["address"])
    expected_allocation = 800 + sum(MANUAL_ALLOWLIST.values())
    if sum(row["max_mint"] for row in merged) != expected_allocation or any(row["max_mint"] not in {2, 4, 6, 8, 10} for row in merged):
        raise RuntimeError("merged allocation invariant failed")
    write_csv(output / "community-eligible-wallets.csv", ["address", "max_mint"], [{"address": row["address"], "max_mint": row["max_mint"]} for row in merged])
    write_csv(output / "community-allocation-audit.csv", ["address", "max_mint", "collections"], merged)
    write_csv(output / "snapshot-sources.csv", ["collection", "snapshotBlock", "snapshotAt", "eligibleHolders", "allocation"], sources)

    file_hashes = {}
    for path in sorted(output.glob("*.csv")):
        file_hashes[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
    report = {
        "chain": "Robinhood Chain mainnet", "snapshotBlock": block_number, "snapshotAt": taken_at,
        "collections": sources, "manualAllowlist": MANUAL_ALLOWLIST,
        "uniqueWallets": len(merged), "communityAllocation": expected_allocation,
        "allocationValues": sorted({row["max_mint"] for row in merged}), "excluded": "zero, dead and bytecode-bearing addresses",
        "fileSha256": file_hashes,
    }
    (output / "snapshot-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"snapshotBlock": block_number, "wallets": len(merged), "allocation": expected_allocation}))


if __name__ == "__main__":
    main()
