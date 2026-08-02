# Loxleys Frontend

Vite, React, TypeScript, wagmi, and RainbowKit application for Robinhood Chain mainnet.
Every main navigation item is a real route backed by contract reads, API calls, or transaction
flows.

## Routes

- `/` - project narrative, Public/Outlaw identity model, and on-chain architecture.
- `/agent` - owner/controller state, Adapter8004 binding, NFT-derived persona, memories, trait-derived capabilities, and alliances.
- `/trading` - Robinhood agentic trading integration, MCP config for AI agents, trade memory log, and Robinhood account link.
- `/canvas` - 40x40 Public/Outlaw editor, local drafts, import/export, delegation, permanent
  sealing, and owner-controlled active identity selection.
- `/docs` - protocol, reveal, Canvas, Agent and alliance guidance.
- `/api` - live checks against the configured Hono Agent API.

## Visual System

The current interface uses an off-white grid surface, dark bitmap typography, thin rules, and
phosphor green only for active state and primary actions. NFT portraits always retain their
contract render colors: black `#0A0A0A` and green `#CDFF00`/the matching frontend accent.

Desktop navigation is a compact text rail. Mobile uses one global horizontal route rail below
the header. Operational pages prioritize their working surface; Canvas keeps the editor ahead
of the inspector on narrow viewports.

## Canvas Behavior

- Draft edits remain local until the holder confirms sealing.
- Draft storage is scoped by chain, Art contract, token ID, and wallet.
- Import validates version, network, collection, token, 200-byte overlay, hash, and pixel count.
- Only the owner or current delegate can seal.
- A sealed overlay is read-only and its Public view remains available.
- The current owner can switch marketplace metadata between Public and Outlaw after sealing.
- Delegates may seal an authorized draft but cannot change the active identity afterward.

## Setup

```shell
npm install
cp .env.example .env
npm run dev
```

Required production configuration:

- `VITE_WALLETCONNECT_PROJECT_ID`
- `VITE_ROBINHOOD_RPC_URL`
- `VITE_PUBLIC_API_BASE_URL`
- `VITE_LOXLEYS_ART_ADDRESS`
- `VITE_LOXLEYS_CANVAS_ADDRESS`
- `VITE_AGENT_EXTENSIONS_ADDRESS`
- `VITE_ADAPTER8004_ADDRESS` when the external adapter is available

Without an adapter address, the app remains usable but displays `Adapter pending` and disables
registration. A development WalletConnect fallback allows local builds, but production must use
a real WalletConnect Cloud project ID.

## Commands

```shell
npm run dev
npm run build
npm run preview
```
