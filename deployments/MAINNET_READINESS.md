# Mainnet readiness — 22 July 2026

## Passed

- Robinhood mainnet RPC reports chain ID `4663`.
- SeaDrop `0x00005EA00Ac477B1030CE78506496e8C2dE24bf5` has 21,081 bytes of live bytecode.
- The configured deployer key resolves to `0x07F7fA43551F5e60bEDCB9c381f95b18DC983CFB`.
- Community allowlist has 396 unique wallets and a total allocation of 808.
- Team allowlist contains the deployer with allocation 150.
- Team, Community and Public stages are free; Public wallet limit is 1.
- All 34 Solidity tests pass after the owner-reveal, exact-ten Named Rare and transfer-epoch
  hardening changes. The live Robinhood mainnet fork wiring test also passes.
- Production `LoxleysArt` runtime is 23,391 bytes, 1,185 bytes below EIP-170.
- The production deploy script now rejects the wrong chain, wrong deployer key, unexpected or
  empty SeaDrop before broadcasting.
- Quiver is no longer a dependency. Reveal uses a one-time owner-selected offset after
  irreversible mint closure; this is immutable but is not verifiable randomness.
- A no-broadcast Robinhood mainnet deployment simulation passed. At the sampled gas price it
  estimated `0.00247370935323347 ETH` for the four-contract deployment and wiring transactions.
  With deployer nonce `2`, the simulation predicts Art `0x58b40A71A3355286f59013627947578C6EDb5701`,
  Canvas `0xc8E69C8214c30B0ef544A9c491a7FaCbAa9a6C2E`, Renderer
  `0xe4965ad0CED8Ce4D17d1537c7A0ddEF1aB46e78c` and Extensions
  `0x8bd8A1893bD473Ca25Ae91f060F5D2615b8e5a38`. These are predictions, not deployed addresses
  and must be recalculated if the nonce changes.
- Canvas delegates and pending alliances are bound to a per-token ownership epoch, preventing
  stale authorizations from reviving after an ownership round trip.
- Exactly ten Named Rare slots are enforced on-chain. Reveal rejects an offset that would leave
  any of those ten outside the final minted supply.
- The local 2,000-item art/trait audit, OpenSea package validation, API tests/typecheck/build and
  frontend production build pass.
- Worst-case fragmented privileged Canvas metadata is covered by a regression test. Linear SVG
  assembly reduced measured `tokenURI` gas from about 781 million to about 15.9 million and the
  test enforces a 20 million upper bound.
- `PUBLIC_API_BASE_URL` is intentionally deferred and does not block contract deployment.

## Blocking deployment

- The deployer mainnet balance is `0.016109440133242082 ETH`. This covers the sampled contract
  deployment estimate but does not meet the conservative full-run target for 20 high-gas
  SSTORE2 art uploads and safety margin. Fund to approximately `0.025–0.030 ETH` total before
  broadcast so deployment and initialization can complete in one uninterrupted run.

## Blocking OpenSea publication, not contract deployment

- `openSeaDropUrl` remains empty until the custom contract is attached in OpenSea Studio.
- Production API, indexer and frontend contract addresses can only be filled after deployment.
- Adapter8004 remains intentionally absent until an official registry is available.

## Ownership rule

- Art, Canvas and AgentExtensions must retain the same owner. The Canvas `privilegedArtist` is
  immutable and is the deployment owner. Never transfer only one module. A future ownership
  migration needs a replacement Canvas if the privileged artist must also change; production
  preflight deliberately fails on split ownership.

No mainnet transaction should be broadcast until the remaining deployment blocker and all
post-change verification gates pass.
