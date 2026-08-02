# Production preflight

Publication is intentionally blocked until `drop-config.json` contains the verified Robinhood
SeaDrop address, OpenSea Drop URL and UTC start/end times. All prices are locked to zero and the
public wallet limit is locked to one.

## Required sequence

1. Run `python3 pipeline/build_seadrop_allowlists.py`; expect 396 Community rows totalling 808
   and one Team row with limit 150.
2. Copy `drop-config.example.json` to `drop-config.json`, complete it, then run
   `python3 pipeline/validate_drop_config.py --pre-studio`. After Studio creates the Drop URL,
   add it and run the same command without `--pre-studio` for the publication gate.
3. Reverify SeaDrop `0x00005EA00Ac477B1030CE78506496e8C2dE24bf5`. On 22 July 2026 it had
   Robinhood mainnet bytecode and returned the configured public stage for OpenSea's live
   `therobinhood` Drop contract `0x2cb61a81cec32534de271666fa020c89c2dd1920`.
4. Run `forge test` and `forge build --sizes`. All 34 tests must pass and Art must remain below
   EIP-170.
5. Deploy Art -> Canvas -> Renderer -> AgentExtensions and verify all one-time links, owner,
   royalty receiver and allowed SeaDrop. Do not deploy a local identity registry; add an adapter
   only after the official ERC-8004 registry is finalized and verified.
6. Upload 20 art/trait batches and compare every local manifest hash.
7. Configure all ten Named Rare slots, verify their names/traits, then irreversibly call
   `lockTraitOverrides()`. Reveal is contractually blocked until this lock is active.
8. Attach the custom contract in Studio. Upload the headerless Team and Community allowlists,
   configure Public, and verify totals `2000 / 150 / 808`.
9. Perform a controlled mint and verify placeholder, ownership, indexer and Agent API.
10. After sales finish, close minting, call the one-time owner `reveal(offset)`, verify the offset
   and metadata refresh, then enable Canvas usage. The selected offset cannot be changed later.

Do not deploy or publish when any check fails. The OpenSea API key belongs only in the local
environment and must never be committed or copied into reports.

Keep Art, Canvas and AgentExtensions under the same owner. Canvas's deployment-time
`privilegedArtist` cannot be changed; do not transfer module ownership piecemeal.
