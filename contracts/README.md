# Loxleys contracts

Mainnet target: Robinhood Chain (`4663`). Historical testnet deployments are not production
addresses and are not migrated.

## Active architecture

- `LoxleysArt.sol`: custom `ERC721SeaDrop` collection, fixed supply `2,000`, ERC-2981 royalty
  `2.5%`, one-time owner-triggered post-sale reveal, bitmap/trait storage and immutable
  SeaDrop-only mint entry.
- `LoxleysRenderer.sol`: on-chain placeholder, SVG and JSON rendering. Named Rare identity is
  attached to the shuffled art slot, not the pre-reveal token ID.
- `LoxleysCanvas.sol`: one permanent 40×40 XOR overlay containing `1..256` changed pixels for
  normal editors. The immutable deployment artist may use all `1..1600` pixels only as owner or
  current delegate. Sealing and identity switching remain disabled until reveal.
- `AgentExtensions.sol`: memories, derived capabilities and request/accept/break alliances.
- `Adapter8004.sol`: deferred external identity adapter; it is not part of the initial deployment
  and will only be used after an official compatible registry is published.

All 2,000 bitmap slots, including the ten Named Rares, participate in one owner-selected offset.
There is no reserved mint path. The owner can choose the distribution, but the offset becomes
immutable after reveal. Every mint enters through the single verified Robinhood SeaDrop address
passed to the constructor.

## Deployment order

1. Complete and validate `/drop-config.json`; production validation fails while stage dates or
   the Drop URL are absent. Robinhood SeaDrop is locked to
   `0x00005EA00Ac477B1030CE78506496e8C2dE24bf5` and must be reverified before broadcast.
2. Fund the deployer, then deploy Art, Canvas, Renderer and AgentExtensions using
   `script/Deploy.s.sol`. No identity registry is deployed.
3. Verify the one-time Art wiring and upload all 20 bitmap/trait batches.
4. Attach the custom Art address to OpenSea and configure Team 150, Community 808 and Public.
5. Mint through SeaDrop. When sales are complete, call `closeMintingForReveal()` once.
6. Call `reveal(offset)` once. After the ERC-4906 refresh, Canvas becomes available.

```sh
forge test
forge build --sizes
```

Current acceptance suite: 34 tests. `LoxleysArt` must remain below the 24,576-byte EIP-170
runtime limit.

Production scripts for art upload, Named Rare configuration and metadata locking require chain
ID `4663`, a matching deployer key/address, deployed Art bytecode and the deployer as Art owner.
Art, Canvas and AgentExtensions ownership must not be split. Canvas's full-portrait
`privilegedArtist` is immutable, so changing that role requires deploying a replacement Canvas.
