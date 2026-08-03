# Loxleys Agent API

Hono service for Loxleys contract projections, ERC-8004-compatible metadata, A2A Agent Cards,
Canvas images, and machine-readable discovery. Live token state is read from Robinhood Chain
mainnet; list and binding queries use the Ponder indexer. Production hosting is deferred until
`PUBLIC_API_BASE_URL` is set and the indexer/runtime is deployed.

## Setup

```shell
npm install
cp .env.example .env
npm run dev
```

Run the Ponder service in `indexer/` separately. The API expects its GraphQL endpoint through
`PONDER_GRAPHQL_URL`.

## Endpoint Surface

- `GET /health`
- `GET /openapi.json`
- `GET /.well-known/agent.json`
- `GET /agents/metadata/:tokenId`
- `GET /agents/info/:tokenId`
- `GET /agents/readiness/:tokenId`
- `GET /agents/agent-card/:tokenId`
- `GET /agents/binding/:tokenId`
- `GET /agents/by-agent-id/:agentId`
- `GET /agents/by-owner/:address`
- `GET /agents/list`
- `GET /agents/:tokenId/canvas`
- `GET /agents/:tokenId/memories`
- `GET /agents/:tokenId/capabilities`
- `GET /agents/:tokenId/alliances`
- `GET /agents/:tokenId/prompt.txt`
- `GET /agents/:tokenId/trading`
- `POST /mcp`
- `GET /mcp/config/:tokenId`
- `GET /tokens/:tokenId/identity`
- `GET /llms.txt`

The Canvas response keeps the compatibility field `customized` and adds `sealed`,
`activeIdentity`, `alteredPixels`, `overlayHash`, `publicImage`, and `outlawImage`. Public and
Outlaw images remain independently addressable regardless of the active marketplace identity.
The identity route returns a read-only HTML comparison suitable for `tokenURI.animation_url`;
it opens on the active identity and never requests a wallet or submits a transaction.
The readiness route summarizes metadata, A2A, Adapter8004, Canvas, extension, and OpenSea
identity-embed status for a token. The API persona is derived from the NFT traits; memories,
alliances are exposed as runtime context, and capabilities are derived from immutable NFT
traits. There is no API or frontend path for assigning capabilities.

The alliances route preserves `allies` and adds `incomingRequests` plus `outgoingRequests`.
Pending rows from the event indexer are revalidated with the live contract, so a request made
stale by an NFT transfer is not returned as actionable. The plain-text prompt route gives any
LLM a short bootstrap pointing to identity, alliances, OpenAPI, `llms.txt`, trading and MCP.

```shell
curl "$PUBLIC_API_BASE_URL/agents/1/prompt.txt"
curl "$PUBLIC_API_BASE_URL/agents/1/alliances"
```

## Agentic Trading (MCP)

`POST /mcp` is a JSON-RPC endpoint implementing the Model Context Protocol. AI agents
(Claude Code, ChatGPT, Grok, Cursor) connect here to access Loxley identity and proxy trades
to `ROBINHOOD_MCP_ENDPOINT` (defaults to `https://agent.robinhood.com/mcp/trading`).

Available MCP tools: `get_agent_identity`, `get_portfolio`, `place_order`, `get_trade_history`,
`log_trade_memory`, `get_alliances`.

`GET /mcp/config/:tokenId` returns a ready-to-paste MCP configuration block for AI clients.
`GET /agents/:tokenId/trading` returns the agent's trading state and compact trade memories.
On-chain memory suggestions are restricted to 1-96 printable ASCII bytes, matching
`AgentExtensions.remember`.

Loxleys never stores Robinhood auth tokens — they are passed per-request via the
`Authorization: Bearer` header. Query-string tokens are intentionally rejected so credentials
do not leak through URLs, access logs, or browser history.

## Mainnet state

- `LoxleysArt`: `0xc8E69C8214c30B0ef544A9c491a7FaCbAa9a6C2E`
- `LoxleysCanvas`: `0xab7b708fA45D8929449f43f4E2724e0eb29a2C74`
- `LoxleysRenderer`: `0x4430D15C381cEcC7fC1c600D9cFBE6FD8d934623`
- `AgentExtensions`: not deployed/wired
- `Adapter8004`: not configured

Routes that only need Art/Canvas can be enabled once the hosted API/indexer is configured.
Memory, alliance, binding and trading flows must stay disabled until the extension and adapter
addresses are deployed, verified and added to the runtime.

## Adapter State

`ADAPTER8004_ADDRESS` may stay empty in development until the mainnet adapter is deployed.
Health and binding routes then return `adapter_not_configured` rather than failing startup.

## Production preflight

Before publishing a hosted API or setting `animationBaseURI`, run:

```shell
npm run preflight
```

For a production gate that requires a non-local HTTPS `PUBLIC_API_BASE_URL`, an Adapter8004
address, and matching on-chain `animationBaseURI`, run:

```shell
npm run preflight:production
```

The preflight reads the configured Robinhood mainnet contracts, checks chain `4663`, the 2,000
supply cap, Art/Canvas/Renderer wiring, both edge art batches and current mint/reveal state.
Production also requires the Adapter8004 and a public HTTPS API URL only when agent/binding
flows are being enabled.

## Commands

```shell
npm test
npm run typecheck
npm run build
npm run dev
npm run start
```
