# Loxleys architecture

## Contract graph

```text
OpenSea Drop -> verified SeaDrop -> LoxleysArt (ERC721SeaDrop, owner-triggered reveal)
                                      |-- LoxleysRenderer (on-chain SVG/JSON)
                                      |-- LoxleysCanvas (one-time 1..256; deployment artist 1..1600)
                                      `-- AgentExtensions (memory/capability/alliance)
                                                   `-- Adapter8004
```

`LoxleysArt` is the ownership and immutable art root. It stores 20 SSTORE2 batches, each with
100 200-byte bitmaps and eight-byte trait records. Token IDs begin at 1. Reveal maps token `t`
to zero-indexed slot `(t - 1 + startIndex) % 2000`; this is a full permutation.

Before reveal, `tokenURI` delegates to the renderer's shared placeholder and art-slot reads are
blocked. After `closeMintingForReveal`, only the owner can call `reveal(offset)` once. The offset
becomes immutable and completion emits ERC-4906 `BatchMetadataUpdate`. This is not verifiable
randomness: the owner can choose the final distribution.

SeaDrop enforces the Team, Community and Public stages. The NFT contract independently enforces
the total 2,000 cap and rejects SeaDrop mint calls after irreversible mint closure. OpenSea PNG
and metadata CSV files are previews only and never override canonical `tokenURI`.

Canvas stores a 200-byte XOR mask through SSTORE2. Popcount must be 1 through 256 for normal
owners/delegates. The immutable deployment artist may use all 1,600 pixels only while owning the
NFT or holding its current owner's explicit delegation. Sealing is write-once, and the current
NFT owner controls delegation and Public/Outlaw display. Transfers move Canvas and Agent
authority automatically.

The indexer consumes standard ERC-721 transfers plus Loxleys memory/alliance/reveal events. The
Public API keeps `allies` backward-compatible and adds incoming/outgoing requests, OpenAPI 3.1,
`llms.txt`, agent discovery, MCP discovery and a per-token `prompt.txt`.

Production is Robinhood Chain `4663`. Addresses are supplied only after deployment; legacy
testnet addresses must not appear in mainnet environment examples.
