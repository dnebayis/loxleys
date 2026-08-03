# Loxleys

Loxleys is a 2,000-supply, fully on-chain identity collection live on
Robinhood Chain mainnet. Every token begins with an immutable 40x40 **Public Identity** and can
receive one permanent, holder-authored **Outlaw Identity**.

The Robin Hood connection is structural rather than decorative: the Public face is the
identity known in Nottingham, while the Outlaw face is the identity chosen before entering
Sherwood. A holder or valid delegate may alter 1-256 pixels once. The immutable deployment
artist may use the full 1,600-pixel Canvas, but only while owning the NFT or holding a current
owner-granted delegation. After sealing, the Outlaw
face can never be edited or removed, while the original Public face remains available. The
current owner chooses which of the two identities is active in marketplace metadata.

Loxleys also includes an optional agent layer in the codebase. Tokens are designed to support
bounded memories, trait-derived capabilities, mutual alliances, and a future external Adapter8004
identity without changing ERC-721 ownership or the Canvas rules. The mainnet core deployment
does not currently wire `AgentExtensions` or Adapter8004.

## Mainnet status

- **Network:** Robinhood Chain mainnet, chain ID `4663`
- **OpenSea collection:** https://opensea.io/collection/loxleysnft/overview
- **SeaDrop:** `0x00005EA00Ac477B1030CE78506496e8C2dE24bf5`
- **Owner/deployer:** `0x07F7fA43551F5e60bEDCB9c381f95b18DC983CFB`
- **LoxleysArt:** `0xc8E69C8214c30B0ef544A9c491a7FaCbAa9a6C2E`
- **LoxleysCanvas:** `0xab7b708fA45D8929449f43f4E2724e0eb29a2C74`
- **LoxleysRenderer:** `0x4430D15C381cEcC7fC1c600D9cFBE6FD8d934623`
- **Mint/reveal:** sold out at `2,000`; minting closed; revealed with immutable offset `1346`
- **Named Rare token IDs after reveal:** `645` through `654`
- **Deferred:** `AgentExtensions`, Adapter8004, hosted Public API base URL

## System

- **Art:** 2,000 generated portraits packed into 200-byte, 1-bit bitmaps and stored with SSTORE2.
- **Supply:** 2,000 tokens in one owner-offset reveal pool, including ten Named Rare art slots.
- **Metadata:** on-chain ERC-721 metadata and SVG, with ERC-2981 royalties and ERC-4906 updates.
- **Traits:** uploaded trait bytes feed metadata, persona, and capabilities; owner-only
  correction overrides are locked on mainnet.
- **Canvas:** one write-once 200-byte XOR overlay, normally limited to 1-256 altered pixels.
- **Control:** the owner or a transfer-safe owner-appointed delegate may seal the Outlaw face.
- **Active identity:** after sealing, only the current owner can select Public or Outlaw without
  changing either portrait.
- **Extensions:** append-only memories, trait-derived capabilities, and mutual alliances are
  implemented but not wired in the current mainnet core deployment.
- **Identity:** Adapter8004 is deferred until an official compatible registry path is available.
- **Trading:** MCP server bridges Loxley agent identity to Robinhood's Agentic Trading endpoint
  once the public API/runtime is configured.
- **Runtime:** Hono API plus a Ponder ownership and Canvas projection; extension/binding
  projections stay disabled until the extension layer is deployed.

## Repository

```text
contracts/   Foundry contracts, tests, deployment, upload, reveal, and registration scripts
pipeline/    Flux generation, quality gates, bitmap packing, traits, and previews
frontend/    React application for collection, Canvas, docs, and API checks; Agent/Trading are staged
api/         Hono Agent API, MCP trading server, and Ponder indexer
docs/        Product narrative and implementation-aligned architecture
```

## Documentation

- [`docs/PROJECT.md`](docs/PROJECT.md) - product concept, Robin Hood narrative, and identity model.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - contracts, runtime, tests, and mainnet deployment.
- [`docs/PRODUCTION_PREP.md`](docs/PRODUCTION_PREP.md) - locked hardening steps and deferred integrations.
- [`contracts/README.md`](contracts/README.md) - Foundry commands and operational scripts.
- [`pipeline/README.md`](pipeline/README.md) - generation and bitmap format.
- [`frontend/README.md`](frontend/README.md) - frontend setup and routes.
- [`api/README.md`](api/README.md) - API setup and public endpoint surface.

## Mainnet release model

- Preserve the current Public/Outlaw identity, on-chain art, Canvas, and agent architecture.
- Mint through OpenSea SeaDrop using the custom `ERC721SeaDrop`-based Loxleys contract.
- Keep canonical metadata and SVG rendering on-chain; Studio files are operational previews only.
- Reveal the full 2,000-slot pool with a one-time owner-selected offset after minting closes.
  The offset is immutable on-chain, but it is not verifiable randomness.

## Local Development

Each package is run independently:

```shell
cd frontend && npm install && npm run dev
cd api && npm install && npm run dev
cd api/indexer && npm install && npm run dev
cd contracts && forge test --offline
```

Copy the relevant `.env.example` file before starting a service. Adapter8004 remains an
external dependency; when no adapter address is configured, registration is disabled and API
responses explicitly return `adapter_not_configured`.
