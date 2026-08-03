# Loxleys architecture

## Contract graph

```text
OpenSea Drop -> verified SeaDrop -> LoxleysArt (ERC721SeaDrop, owner-triggered reveal)
                                      |-- LoxleysRenderer (on-chain SVG/JSON)
                                      |-- LoxleysCanvas (one-time 1..256; deployment artist 1..1600)

Deferred agent layer:
LoxleysArt -> AgentExtensions (memory/capability/alliance) -> Adapter8004
```

`LoxleysArt` is the ownership and immutable art root. It stores 20 SSTORE2 batches, each with
100 200-byte bitmaps and eight-byte trait records. Token IDs begin at 1. Reveal maps token `t`
to zero-indexed slot `(t - 1 + startIndex) % 2000`; this is a full permutation.

Before reveal, `tokenURI` delegates to the renderer's shared placeholder and art-slot reads are
blocked. After `closeMintingForReveal`, only the owner can call `reveal(offset)` once. The offset
becomes immutable and completion emits ERC-4906 `BatchMetadataUpdate`. This is not verifiable
randomness: the owner can choose the final distribution. Mainnet has already been revealed with
offset `1346`.

SeaDrop enforces the Team, Community and Public stages. The NFT contract independently enforces
the total 2,000 cap and rejects SeaDrop mint calls after irreversible mint closure. OpenSea PNG
and metadata CSV files are previews only and never override canonical `tokenURI`.

Canvas stores a 200-byte XOR mask through SSTORE2. Popcount must be 1 through 256 for normal
owners/delegates. The immutable deployment artist may use all 1,600 pixels only while owning the
NFT or holding its current owner's explicit delegation. Sealing is write-once, and the current
NFT owner controls delegation and Public/Outlaw display. Transfers move Canvas and Agent
authority automatically.

The current mainnet core deployment wires Art, Canvas and Renderer only. `AgentExtensions` and
Adapter8004 remain disabled until the official registry/integration path is finalized. The
indexer should therefore consume standard ERC-721 transfers, reveal and Canvas events first;
memory/alliance/binding projections become active only after the extension layer is deployed.
The Public API surface keeps the planned `allies` compatibility model, incoming/outgoing
requests, OpenAPI 3.1, `llms.txt`, agent discovery, MCP discovery and per-token `prompt.txt`,
but production hosting is deferred until `PUBLIC_API_BASE_URL` is set.

## Production addresses

- Network: Robinhood Chain mainnet `4663`
- Explorer: `https://robinhoodchain.blockscout.com`
- SeaDrop: `0x00005EA00Ac477B1030CE78506496e8C2dE24bf5`
- Owner/deployer: `0x07F7fA43551F5e60bEDCB9c381f95b18DC983CFB`
- `LoxleysArt`: `0xc8E69C8214c30B0ef544A9c491a7FaCbAa9a6C2E`
- `LoxleysCanvas`: `0xab7b708fA45D8929449f43f4E2724e0eb29a2C74`
- `LoxleysRenderer`: `0x4430D15C381cEcC7fC1c600D9cFBE6FD8d934623`
- `AgentExtensions`: not deployed/wired on mainnet

Legacy testnet addresses must not appear in mainnet environment examples.
