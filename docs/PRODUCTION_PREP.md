# Production release notes

The Robinhood Chain mainnet release is deployed, minted out and revealed. This file remains as
the operational sequence used for the release and the checklist to repeat if a replacement
deployment is ever required.

## Completed sequence

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
5. Deploy Art -> Canvas -> Renderer and verify all one-time links, owner, royalty receiver and
   allowed SeaDrop. Do not deploy a local identity registry; add AgentExtensions/adapter only
   after the official ERC-8004 registry path is finalized and verified.
6. Upload 20 art/trait batches and compare every local manifest hash.
7. Configure all ten Named Rare slots, verify their names/traits, then irreversibly call
   `lockTraitOverrides()`. Reveal is contractually blocked until this lock is active.
8. Attach the custom contract in Studio. Upload the OpenSea-template Team and Community
   allowlists, configure Public, and verify totals `2000 / 150 / 808`.
9. Perform a controlled mint and verify placeholder, ownership, indexer and Agent API.
10. After sales finish, close minting, call the one-time owner `reveal(offset)`, verify the offset
   and metadata refresh, then enable Canvas usage. The selected offset cannot be changed later.

Do not deploy or publish a replacement when any check fails. The OpenSea API key belongs only in
the local environment and must never be committed or copied into reports.

## Mainnet result

- `LoxleysArt`: `0xc8E69C8214c30B0ef544A9c491a7FaCbAa9a6C2E`
- `LoxleysCanvas`: `0xab7b708fA45D8929449f43f4E2724e0eb29a2C74`
- `LoxleysRenderer`: `0x4430D15C381cEcC7fC1c600D9cFBE6FD8d934623`
- SeaDrop: `0x00005EA00Ac477B1030CE78506496e8C2dE24bf5`
- Owner/deployer: `0x07F7fA43551F5e60bEDCB9c381f95b18DC983CFB`
- Minted supply: `2,000 / 2,000`
- Reveal offset: `1346`
- AgentExtensions/Adapter8004: deferred, not deployed/wired

Keep Art and Canvas under the same owner. Canvas's deployment-time `privilegedArtist` cannot be
changed; do not transfer module ownership piecemeal. If AgentExtensions is deployed later, wire
and document it as a separate production change.
