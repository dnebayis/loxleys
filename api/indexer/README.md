# Loxleys Ponder Indexer

Ponder projection for Loxleys ownership, one-time Outlaw seals, delegation, agent extensions,
and Adapter8004 bindings.

## Indexed Events

- `LoxleysArt.Transfer`
- `LoxleysCanvas.OutlawSealed`
- `LoxleysCanvas.ActiveIdentitySet`
- `LoxleysCanvas.DelegateSet`
- AgentExtensions memory and alliance lifecycle events. Capabilities are derived from NFT
  traits at runtime and are not assigned or indexed as extension state.
- `Adapter8004.AgentBound` when an adapter address is configured

A transfer updates ownership and clears the indexed delegate view. It does not delete a sealed
Outlaw identity or its active-identity state. `ActiveIdentitySet` projects whether Public or
Outlaw currently represents the token. Bindings are indexed by
`(standard, tokenContract, tokenId)` and by `agentId`.

## Setup

```shell
npm install
cp .env.local.example .env.local
npm run codegen
npm run dev
```

Production mode requires a dedicated `DATABASE_SCHEMA` such as
`loxleys_v4_trait_override_capabilities`. The Ponder API
entrypoint exposes GraphQL at `/graphql`; Ponder provides its own `/health` and `/ready` routes.

`ADAPTER8004_ADDRESS` may remain empty until the external deployment exists. The Loxleys
contracts continue indexing without adapter events.

## Commands

```shell
npm run codegen
npm run typecheck
npm run dev
npm run start
```
