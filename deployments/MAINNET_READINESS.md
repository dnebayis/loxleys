# Mainnet release record — 3 August 2026

This file is the production deployment record for the Robinhood Chain mainnet release. It
replaces the earlier readiness checklist and must not contain simulated or predicted addresses.

## Network and ownership

- Network: Robinhood Chain mainnet
- Chain ID: `4663`
- Explorer: `https://robinhoodchain.blockscout.com`
- SeaDrop: `0x00005EA00Ac477B1030CE78506496e8C2dE24bf5`
- Owner/deployer: `0x07F7fA43551F5e60bEDCB9c381f95b18DC983CFB`
- OpenSea collection: `https://opensea.io/collection/loxleysnft/overview`

## Deployed contracts

- `LoxleysArt`: `0xc8E69C8214c30B0ef544A9c491a7FaCbAa9a6C2E`
- `LoxleysCanvas`: `0xab7b708fA45D8929449f43f4E2724e0eb29a2C74`
- `LoxleysRenderer`: `0x4430D15C381cEcC7fC1c600D9cFBE6FD8d934623`

`AgentExtensions` was intentionally not deployed or wired on mainnet. Adapter8004 remains
deferred until the official compatible registry/integration path is available.

Core deployment details are recorded in
`deployments/robinhood-mainnet-core-2026-08-03.json`.

## Release state

- Total supply: `2,000`
- Mint path: OpenSea SeaDrop only
- Mint status: sold out
- Art upload: `20 / 20` SSTORE2 bitmap/trait batches uploaded
- Named Rare metadata: configured and locked
- Trait overrides: locked by `lockTraitOverrides()`
- Mint closure: complete
- Reveal: complete
- Reveal offset / `startIndex`: `1346`
- `startIndexSet`: `true`
- `mintClosed`: `true`

Art upload, metadata lock and reveal details are recorded in
`deployments/robinhood-mainnet-art-upload-2026-08-03.json`.

## Reveal transactions

- `closeMintingForReveal()`:
  `0x4307b8fda1030da5753a31ee9942e97a5cfd173552b878870ba002b44a9628b2`
- `reveal(1346)`:
  `0xe1d577beec71bf08b6fd7a74d0707d0ec1bbdc22058a7b92f17f2b4e3afcf1ab`
- Offset derivation used operationally:
  `uint256(closeMintingForRevealTxHash) % 2000`

The reveal offset is immutable after `reveal`. This design uses an owner-selected offset and is
not verifiable randomness.

## Named Rare token IDs after reveal

- `645`: Robin Hood
- `646`: Maid Marian
- `647`: Little John
- `648`: Friar Tuck
- `649`: Will Scarlet
- `650`: Alan-a-Dale
- `651`: Much the Miller's Son
- `652`: Sheriff of Nottingham
- `653`: Sir Guy of Gisborne
- `654`: King Richard

## Current operational notes

- Canonical metadata and SVG are on-chain through `tokenURI`.
- OpenSea preview PNG/CSV files are operational references only and must not replace canonical
  token metadata.
- Canvas is available only after reveal and remains write-once per token.
- Normal Canvas edits are limited to `1..256` changed pixels.
- The immutable deployment artist may use up to `1..1600` changed pixels only while owning the
  NFT or holding a current owner-granted delegation.
- `PUBLIC_API_BASE_URL` is still deferred and should be set only when a production API/indexer
  is hosted.
- Future agent/trading features must not assume `AgentExtensions` exists on mainnet until it is
  deployed, verified and explicitly wired.
