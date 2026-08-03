# Loxleys project specification

Status: SeaDrop-compatible Robinhood Chain mainnet release. The collection is minted out and
revealed. Core contracts are live; the optional AgentExtensions/Adapter8004 layer is deliberately
not deployed yet.

Loxleys is a 2,000-supply on-chain Agent NFT collection. Each NFT combines an immutable Public
Identity and an optional owner-sealed Outlaw Identity. The codebase also defines persistent
memories, derived capabilities, alliances and Adapter8004 binding for a later extension release.

## NFT lifecycle

1. OpenSea SeaDrop minted the custom `LoxleysArt` NFT. Direct public/owner mint functions do not
   exist.
2. After the sale completed, the owner permanently closed minting.
3. The deployed collection was revealed with immutable offset `1346`. Ten Named Rare slots had
   no reservation; their bitmap, traits, name and persona moved together. The distribution is
   owner-selected rather than verifiably random.
4. ERC-4906 refreshed marketplace metadata. The canonical JSON/SVG remains on-chain.
5. After reveal, an owner or delegate may seal exactly one `1..256` pixel XOR overlay. The
   immutable deployment artist may use `1..1600` pixels, but only on NFTs they own or for which
   the current owner explicitly made them delegate. The bitmap cannot be replaced; the owner
   may switch between Public and Outlaw views.

## Agent and alliances

Token ownership is the root authorization. The planned extension layer lets a holder append
bounded memories, inspect trait-derived capabilities, request an alliance, accept an incoming
request, or break an active alliance. Mutual pending requests form the alliance automatically. A
transfer invalidates stale requests because the recorded requester owner no longer matches
current ownership. The API and UI are designed to expose active allies, incoming requests and
outgoing requests separately. On mainnet this layer remains disabled until `AgentExtensions` and
the official Adapter8004 path are deployed.

## Allocation

- Team: free, one locked wallet, `150` maximum.
- Community: free, `396` unique wallets, limits `2/4/6/8`, total `808`.
- Public: free, limit `1` per wallet, all remaining supply; unused Team/Community capacity is
  not reserved forever.

The three stages used one shared 2,000-token global supply; Team and Community limits were
eligibility ceilings, not reserved token buckets. Any unminted capacity became available when
Public began.

## Production addresses

- `LoxleysArt`: `0xc8E69C8214c30B0ef544A9c491a7FaCbAa9a6C2E`
- `LoxleysCanvas`: `0xab7b708fA45D8929449f43f4E2724e0eb29a2C74`
- `LoxleysRenderer`: `0x4430D15C381cEcC7fC1c600D9cFBE6FD8d934623`
- SeaDrop: `0x00005EA00Ac477B1030CE78506496e8C2dE24bf5`
- Owner/deployer: `0x07F7fA43551F5e60bEDCB9c381f95b18DC983CFB`
- OpenSea: `https://opensea.io/collection/loxleysnft/overview`

Mainnet reveal details are recorded in
`deployments/robinhood-mainnet-art-upload-2026-08-03.json`.
