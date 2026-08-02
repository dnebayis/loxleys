# Loxleys — SeaDrop preview and allowlist package

Target: Robinhood Chain mainnet. The custom `LoxleysArt` contract is the canonical NFT and
SeaDrop is the only mint path. This directory performs no OpenSea or on-chain mutation.

The PNGs and `metadata.csv` are preview/operational reference assets only. Final metadata and
SVGs come from the on-chain renderer after the one-time owner reveal; Studio's manual IPFS reveal must
not replace `tokenURI`.

## Supply and stages

- Total supply: `2,000`
- Team stage: `150` for the deployer in `team-allowlist-opensea.csv`
- Community presale: four top-100 holder snapshots, two mints per qualifying collection;
  combined wallet limits are `2`, `4`, `6`, or `8`, totalling `800`; four manual wallets add
  eight allocations, for a community total of `808`
- Public stage: every token remaining after team and community claims
- Every stage is free. Public has a per-wallet limit of `1`.
- Stage inventory is not partitioned on-chain. Team and Community limits are eligibility
  ceilings over the shared 2,000 supply, so every unminted token remains available to Public.
- Unused community capacity rolls into the public stage
- All 2,000 items share one offset-based pool. The ten named rare items are not reserved. The
  owner selects the final offset after minting closes, so the assignment is not random.

## Studio setup order

1. Rotate the OpenSea API key that was shared in chat. Keep its replacement only in
   `OPENSEA_API_KEY`; never paste it into this directory.
2. Copy `drop-config.example.json` to `drop-config.json`, enter prices, exact UTC windows,
   public wallet limit, verified Robinhood SeaDrop address and eventual Drop URL, then run
   `python3 pipeline/validate_drop_config.py`.
3. Deploy the custom contract with exactly the verified Robinhood SeaDrop address, upload art,
   configure all ten Named Rares, verify them, and lock metadata before attaching the contract
   to a new OpenSea Drop. Do not use Studio's standard NFT proxy.
4. Configure Team using `team-allowlist-opensea.csv` and Community using
   `community-allowlist-opensea.csv`. Both are headerless `wallet,custom_limit` files. The
   headered `community-eligible-wallets.csv` remains an audit file, not the Studio upload.
5. Configure the final public stage. Do not cap it at 1,048: it must consume all remaining
   supply so unused community allocation rolls over.
6. Use `images/` and `metadata.csv` only when Studio requests previews. The current example
   schema is `tokenID`, `name`, `description`, `file_name`, `external_url`, then
   `attributes[TraitName]` columns.
7. After sales finish, irreversibly close minting and call `reveal(offset)` once. The contract
   rejects offsets that would leave any Named Rare outside the minted supply. Verify the on-chain
   offset, ERC-4906 refresh and OpenSea metadata. Do not trigger Studio manual reveal.

## Verification

```sh
python3 pipeline/build_opensea_drop.py --validate-only
python3 pipeline/build_seadrop_allowlists.py
python3 pipeline/validate_drop_config.py
```

The last command intentionally fails until the launch values are supplied. `checksums.json`
ties each PNG to its bitmap and traits. `snapshot-report.json` records the fixed snapshot.
