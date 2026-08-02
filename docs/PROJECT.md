# Loxleys project specification

Status: SeaDrop-compatible Robinhood Chain mainnet implementation; publication is gated on
launch configuration and live-address verification.

Loxleys is a 2,000-supply on-chain Agent NFT collection. Each NFT combines an immutable Public
Identity, an optional owner-sealed Outlaw Identity, persistent memories, derived capabilities,
alliances and an Adapter8004 binding.

## NFT lifecycle

1. OpenSea SeaDrop mints the custom `LoxleysArt` NFT. Direct public/owner mint functions do not
   exist. All tokens show the same placeholder before reveal.
2. Once every intended stage is finished, the owner permanently closes minting.
3. After minting closes, the owner selects a one-time offset over all 2,000 art slots. Ten Named
   Rare slots have no reservation; their bitmap, traits, name and persona move together. The
   offset becomes immutable, but the distribution is owner-selected rather than random.
4. ERC-4906 refreshes marketplace metadata. The canonical JSON/SVG remains on-chain.
5. After reveal, an owner or delegate may seal exactly one `1..256` pixel XOR overlay. The
   immutable deployment artist may use `1..1600` pixels, but only on NFTs they own or for which
   the current owner explicitly made them delegate. The bitmap cannot be replaced; the owner
   may switch between Public and Outlaw views.

## Agent and alliances

Token ownership is the root authorization. A holder can append bounded memories, inspect
trait-derived capabilities, request an alliance, accept an incoming request, or break an active
alliance. Mutual pending requests form the alliance automatically. A transfer invalidates stale
requests because the recorded requester owner no longer matches current ownership. The API and
UI expose active allies, incoming requests and outgoing requests separately.

## Allocation

- Team: free, one locked wallet, `150` maximum.
- Community: free, `396` unique wallets, limits `2/4/6/8`, total `808`.
- Public: free, limit `1` per wallet, all remaining supply; unused Team/Community capacity is
  not reserved forever.

Prices, exact UTC windows and public wallet limit are locked in `drop-config.json` and enforced
by the publication preflight.

The three stages use one shared 2,000-token global supply; Team and Community limits are
eligibility ceilings, not reserved token buckets. Any unminted capacity is therefore available
when Public begins. Locked schedule (Europe/Istanbul): Team 23 July 21:00–22:00, Community
23 July 22:00–24 July 00:00, Public from 24 July 00:00. Public uses 1 January 2100 as the
SeaDrop-compatible operational representation of “open-ended”.
