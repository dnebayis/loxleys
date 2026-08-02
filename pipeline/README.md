# pipeline/ - Loxleys Art Generation

Python pipeline for creating Loxleys art inputs consumed by `contracts/script/UploadArt.s.sol`.

Each token output consists of:

- `{tokenId}.bin` - 200 raw bytes for a 40x40 1-bit bitmap.
- `{tokenId}.traits` - a bytes8 trait value encoded as hex.

The contract render path maps bit `1` to phosphor green `#CDFF00` and bit `0` to
black `#0A0A0A`.

## Setup

```bash
cd pipeline
pip install -r requirements.txt
```

Real Flux generation requires a Replicate token:

```bash
export REPLICATE_API_TOKEN=r8_your_token_here
```

`generate.py` also reads `pipeline/.env` when present. Use `--dry-run` for local plumbing
without network calls or paid generation.

## Usage

```bash
# Generate 10 real tokens starting at ID 1
python3 generate.py --count 10 --output ./output/

# Continue from ID 11
python3 generate.py --count 5 --output ./output/ --start-id 11

# Use the cheaper/faster Flux Schnell model for iteration
python3 generate.py --count 3 --output ./output/ --model schnell

# Force a character type, 0-9 from config.CHARACTER_TYPES
python3 generate.py --count 3 --output ./output/ --type 4

# Local test only: random deterministic bitmaps, no API calls
python3 generate.py --count 10 --output ./output/ --dry-run

# Preview generated bitmaps as the on-chain renderer displays them
python3 preview.py --dir ./output/ --out preview.png

# Audit finalized deploy payloads without changing files
python3 audit_traits.py

# Production-style resumable batch generation through Replicate's prediction API
python3 generate_batch_api.py --count 1000 --start-id 1001 --output ./output-klein-2k --model klein --workers 20
```

## Pipeline Steps

1. `traits.py` creates a unique bytes8 trait combination.
2. `trait_names.py` builds a Flux prompt from those traits.
3. `generate.py` calls the selected Flux model through Replicate, unless `--dry-run` is used. The default is `--model dev`; `klein` is used for economical collection-scale runs and `schnell` for rough iteration.
4. `binarize.py` resizes to 40x40, thresholds at 128, and packs 1,600 bits into 200 bytes.
5. `output.py` writes the `.bin` and `.traits` files.
6. `preview.py` renders a local PNG preview with the contract colors.

For large runs, prefer `generate_batch_api.py`. It uses Replicate's prediction
API directly, writes `generation-manifest.jsonl`, skips completed token files on
rerun, and retries failed predictions without losing token IDs.

## Trait Model

The bytes8 trait layout is:

| Byte | Category | Options |
|------|----------|---------|
| 0 | Type | 10 |
| 1 | Gender | 3 |
| 2 | Age | 3 |
| 3 | HairStyle | 23 |
| 4 | FacialFeature | 19 |
| 5 | Eyes | 17 |
| 6 | Expression | 9 |
| 7 | Accessory | 20 |

Type values are weighted during generation. Common types are human archetypes:
`Human Scout`, `Human Rogue`, `Human Hacker`, `Human Ranger`, `Human Oracle`, and
`Human Phantom`. Rare types are `Portrait Dog`, `Portrait Cat`, `Alien`, and
`Secret Agent`. The current weighting targets roughly 72% common humans and 28%
rare portraits before uniqueness retries.

The configured supply target is `MAX_SUPPLY = 2000`, matching `LoxleysArt.MAX_SUPPLY`.
The finalized source set uses Flux 2 Klein for slots `0..1989` and higher-detail Flux Dev
sources for the ten Named Rare slots `1990..1999`. Every source is reduced to the
same 40x40 one-bit contract format and must pass the density/internal-detail quality gate.

## Bitmap Format

```text
40x40 = 1600 bits = 200 bytes
flatIndex = y * 40 + x
byteIndex = flatIndex >> 3
bitPos = 7 - (flatIndex & 7)
pixelOn = (bitmap[byteIndex] >> bitPos) & 1
```

These files are uploaded in batches of 100 by the Foundry upload script.
