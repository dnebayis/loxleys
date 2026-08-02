"""Configuration for the Loxleys art generation pipeline.

Off-chain AI portrait generation for Loxleys (D31): Flux Dev produces monochrome
1-bit pixel-art PFP portraits which are binarized to 200-byte bitmaps and later
stored on-chain. Rendering maps bit=1 -> phosphor green (#CDFF00) and bit=0 ->
black background (D30: black canvas, flat green art, no depth).
"""

# Grid dimensions
GRID_WIDTH = 40
GRID_HEIGHT = 40
TOTAL_PIXELS = GRID_WIDTH * GRID_HEIGHT  # 1600
BITMAP_BYTES = TOTAL_PIXELS // 8  # 200

# Binarization threshold (0-255)
# Pixels <= THRESHOLD -> 1 (foreground = the character: hair, features, outline)
# Pixels  > THRESHOLD -> 0 (background = the face/paper, rendered white)
THRESHOLD = 128

# On-chain render colors (used by preview.py and the on-chain SVG renderer)
RENDER_BG = "#0A0A0A"     # black canvas (D30)
RENDER_FG = "#CDFF00"     # phosphor green art (D22), flat — no depth

# Flux models on Replicate. Use `schnell` for cheapest iteration, `klein` as a
# cheaper middle ground, and `dev` for the higher-quality generation pass.
DEFAULT_FLUX_MODEL = "dev"
FLUX_MODELS = {
    "dev": "black-forest-labs/flux-dev",
    "klein": "black-forest-labs/flux-2-klein-4b",
    "schnell": "black-forest-labs/flux-schnell",
}

# Shared style suffix appended to every prompt. Tuned for clean 1-bit downscaling.
PROMPT_STYLE_SUFFIX = (
    "monochrome 1-bit pixel art, front-facing close bust portrait, face occupies most of the frame, "
    "clearly separated eyes nose mouth and jaw, readable facial expression, bold simple black shapes, "
    "strong white negative space between facial features, high contrast, centered, pure solid white "
    "background, designed for a crisp 40 by 40 bitmap, no featureless silhouette, no text, no watermark"
)

# Character types (Type byte, index -> name). Common types are human portrait
# archetypes; rare types are animal/alien/agent portraits.
CHARACTER_TYPES = {
    0: "human scout",
    1: "human rogue",
    2: "human hacker",
    3: "human ranger",
    4: "human oracle",
    5: "human phantom",
    6: "portrait dog",
    7: "portrait cat",
    8: "alien",
    9: "secret agent",
}

# Weighted type selection for new generations. Indexes match CHARACTER_TYPES.
# Current split: 72% common humans, 28% rare dog/cat/alien/agent.
TYPE_WEIGHTS = [12, 12, 12, 12, 12, 12, 7, 7, 7, 7]

# Trait category definitions: (name, max_value_inclusive). Each trait byte ranges
# 0..max_value. The 8-byte layout mirrors the Normies bytes8 trait model so an
# on-chain trait-lookup library can decode it directly. Human-readable pools for
# each category live in trait_names.py (sizes must match these ranges).
TRAIT_CATEGORIES = [
    ("Type", 9),            # 0: 10 options (0-9) — see CHARACTER_TYPES
    ("Gender", 2),          # 1: 3 options
    ("Age", 2),             # 2: 3 options
    ("HairStyle", 22),      # 3: 23 options
    ("FacialFeature", 18),  # 4: 19 options
    ("Eyes", 16),           # 5: 17 options
    ("Expression", 8),      # 6: 9 options
    ("Accessory", 19),      # 7: 20 options
]

# Generation settings
MAX_RETRIES = 3
MAX_SUPPLY = 2000

# Flux generation parameters
FLUX_PARAMS = {
    "aspect_ratio": "1:1",   # square portrait -> clean 40x40 downscale
    "output_format": "png",
    "num_outputs": 1,
}

FLUX_MODEL_PARAMS = {
    "dev": {},
    "klein": {},
    "schnell": {},
}
