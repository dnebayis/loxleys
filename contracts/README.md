# Loxleys contracts

Production network: Robinhood Chain mainnet (`4663`). Historical testnet deployments are not
production addresses and are not migrated.

## Active architecture

- `LoxleysArt.sol`: custom `ERC721SeaDrop` collection, fixed supply `2,000`, ERC-2981 royalty
  `2.5%`, one-time owner-triggered post-sale reveal, bitmap/trait storage and immutable
  SeaDrop-only mint entry.
- `LoxleysRenderer.sol`: on-chain placeholder, SVG and JSON rendering. Named Rare identity is
  attached to the shuffled art slot, not the pre-reveal token ID.
- `LoxleysCanvas.sol`: one permanent 40×40 XOR overlay containing `1..256` changed pixels for
  normal editors. The immutable deployment artist may use all `1..1600` pixels only as owner or
  current delegate. Sealing and identity switching are available only after reveal.
- `AgentExtensions.sol`: memories, derived capabilities and request/accept/break alliances.
  Implemented but not deployed/wired in the current mainnet core release.
- `Adapter8004.sol`: deferred external identity adapter; it is not part of the initial deployment
  and will only be used after an official compatible registry is published.

All 2,000 bitmap slots, including the ten Named Rares, participate in one owner-selected offset.
There is no reserved mint path. The owner can choose the distribution, but the offset becomes
immutable after reveal. Every mint entered through the single verified Robinhood SeaDrop address
passed to the constructor. Mainnet is sold out and revealed with offset `1346`.

## Mainnet deployment

- `LoxleysArt`: `0xc8E69C8214c30B0ef544A9c491a7FaCbAa9a6C2E`
- `LoxleysCanvas`: `0xab7b708fA45D8929449f43f4E2724e0eb29a2C74`
- `LoxleysRenderer`: `0x4430D15C381cEcC7fC1c600D9cFBE6FD8d934623`
- SeaDrop: `0x00005EA00Ac477B1030CE78506496e8C2dE24bf5`
- Owner/deployer: `0x07F7fA43551F5e60bEDCB9c381f95b18DC983CFB`

Deployment records:

- `../deployments/robinhood-mainnet-core-2026-08-03.json`
- `../deployments/robinhood-mainnet-art-upload-2026-08-03.json`
- `../deployments/MAINNET_READINESS.md`

## Validation

```sh
forge test
forge build --sizes
```

Current acceptance suite: 34 tests. `LoxleysArt` must remain below the 24,576-byte EIP-170
runtime limit.

Production scripts for art upload, Named Rare configuration and metadata locking require chain
ID `4663`, a matching deployer key/address, deployed Art bytecode and the deployer as Art owner.
Art and Canvas ownership must not be split. If `AgentExtensions` is deployed later, ownership and
wiring must be checked separately before enabling agent UI/API flows. Canvas's full-portrait
`privilegedArtist` is immutable, so changing that role requires deploying a replacement Canvas.
