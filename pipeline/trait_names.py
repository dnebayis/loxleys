"""Loxleys trait name pools + prompt builder.

Pool sizes MUST match the ranges in config.TRAIT_CATEGORIES. The same pools are
used to (a) build a descriptive Flux prompt so the generated portrait matches its
traits, and (b) produce human-readable metadata labels for tokenURI later.
"""

from typing import Optional

from config import CHARACTER_TYPES

GENDER = ["masculine", "feminine", "androgynous"]  # 3

AGE = ["young", "adult", "elder"]  # 3

HAIR = [  # 23
    "bald", "buzzcut", "short hair", "messy hair", "spiky hair", "curly hair",
    "afro hair", "wavy hair", "long hair", "bowl cut", "undercut",
    "slicked-back hair", "mohawk", "dreadlocks", "cornrows", "ponytail",
    "top-knot", "man-bun", "bangs", "pigtails", "hooded head",
    "receding hairline", "shaved sides",
]

FACIAL = [  # 19
    "clean-shaven", "stubble", "mustache", "goatee", "full beard", "sideburns",
    "soul patch", "scarred cheek", "freckles", "face tattoo", "war paint",
    "cybernetic jaw", "nose ring", "eye scar", "beauty mark", "wrinkles",
    "dimples", "cheek markings", "chin strap beard",
]

EYES = [  # 17
    "normal eyes", "round glasses", "square glasses", "sunglasses", "cyber visor",
    "glowing cyber eye", "eyepatch", "monocle", "closed eyes", "winking",
    "wide eyes", "narrow eyes", "glowing eyes", "heterochromia", "tired eyes",
    "sharp piercing eyes", "big round eyes",
]

EXPRESSION = [  # 9
    "neutral", "smiling", "smirking", "frowning", "serious", "surprised",
    "grinning", "scowling", "calm",
]

ACCESSORY = [  # 20
    "nothing on head", "beanie", "cap", "hood up", "helmet", "headphones",
    "headband", "bandana", "glowing halo", "crown", "small horns", "antenna",
    "earring", "neck chain", "scarf", "high collar", "face mask", "cigarette",
    "flower behind ear", "laurel wreath",
]

RARE_TYPES = {"portrait dog", "portrait cat", "alien", "secret agent"}
ANIMAL_TYPES = {"portrait dog", "portrait cat"}

ROLE_PROMPTS = {
    "human scout": "human field scout, alert practical face",
    "human rogue": "human outlaw rogue, sharp mischievous face",
    "human hacker": "human hacker, focused tactical face",
    "human ranger": "human forest ranger, rugged calm face",
    "human oracle": "human mystic oracle, still enigmatic face",
    "human phantom": "human phantom, shadowy mysterious face",
    "portrait dog": "anthropomorphic dog portrait, loyal expressive muzzle",
    "portrait cat": "anthropomorphic cat portrait, sly angular feline face",
    "alien": "alien portrait, otherworldly humanoid face",
    "secret agent": "secret agent portrait, covert composed face",
}

LEGENDARY_CHARACTERS = {
    1991: ("Robin Hood", "iconic heroic outlaw, feathered cap and hood, confident archer face, bow visible behind shoulder"),
    1992: ("Maid Marian", "legendary noble forest heroine, long hair under a light hood, calm determined face"),
    1993: ("Little John", "towering loyal outlaw, broad powerful face, short beard, quarterstaff visible behind shoulder"),
    1994: ("Friar Tuck", "jovial forest friar, tonsure haircut, round expressive face, simple rope collar"),
    1995: ("Will Scarlet", "elegant young outlaw, sharp confident face, feathered cap, narrow scarf"),
    1996: ("Alan-a-Dale", "wandering minstrel outlaw, expressive singing face, feathered cap, lute neck behind shoulder"),
    1997: ("Much the Miller's Son", "young resourceful outlaw, flour-dusted cap motif, alert friendly face"),
    1998: ("Sheriff of Nottingham", "stern medieval sheriff, severe angular face, official chain and rigid cap"),
    1999: ("Sir Guy of Gisborne", "menacing armored knight, scarred intense face, dark hood and high collar"),
    2000: ("King Richard", "lionhearted medieval king, strong noble face, simple crown and royal collar"),
}

# Gender byte overrides for named 1/1 characters. Their image prompts are
# character-specific, so metadata must not inherit the random collection trait.
LEGENDARY_GENDERS = {
    1991: 0,  # Robin Hood
    1992: 1,  # Maid Marian
    1993: 0,  # Little John
    1994: 0,  # Friar Tuck
    1995: 0,  # Will Scarlet
    1996: 0,  # Alan-a-Dale
    1997: 0,  # Much the Miller's Son
    1998: 0,  # Sheriff of Nottingham
    1999: 0,  # Sir Guy of Gisborne
    2000: 0,  # King Richard
}

POOLS = {
    "Type": [CHARACTER_TYPES[i] for i in range(len(CHARACTER_TYPES))],
    "Gender": GENDER,
    "Age": AGE,
    "HairStyle": HAIR,
    "FacialFeature": FACIAL,
    "Eyes": EYES,
    "Expression": EXPRESSION,
    "Accessory": ACCESSORY,
}


def label(category: str, value: int) -> str:
    """Human-readable label for a trait byte value (for metadata)."""
    pool = POOLS[category]
    return pool[value] if 0 <= value < len(pool) else pool[0]


def apply_legendary_overrides(token_id: int, traits: bytes) -> bytes:
    """Return traits with character-specific metadata enforced for named 1/1s."""
    gender = LEGENDARY_GENDERS.get(token_id)
    if gender is None:
        return traits
    normalized = bytearray(traits)
    normalized[1] = gender
    return bytes(normalized)


def build_prompt(traits: bytes) -> str:
    """Assemble a Flux prompt from an 8-byte trait combination.

    Only visually meaningful traits at 40x40 are emphasized (type, hair, eyes,
    facial hair, expression, headwear). 'None'-like values are skipped so the
    prompt stays clean.
    """
    from config import PROMPT_STYLE_SUFFIX

    t = list(traits)
    typ = label("Type", t[0])
    gender = label("Gender", t[1])
    age = label("Age", t[2])
    hair = label("HairStyle", t[3])
    facial = label("FacialFeature", t[4])
    eyes = label("Eyes", t[5])
    expr = label("Expression", t[6])
    acc = label("Accessory", t[7])

    role = ROLE_PROMPTS[typ]
    rarity = "rare" if typ in RARE_TYPES else "common"

    parts = [
        f"{rarity} {age} {gender} {role}",
        "Loxleys collection character",
    ]

    if typ in ANIMAL_TYPES:
        if hair not in {"bald", "hooded head"}:
            parts.append(f"{hair} as a head silhouette motif")
        if facial not in {"clean-shaven", "stubble", "mustache", "goatee", "full beard"}:
            parts.append(facial)
    elif typ == "alien":
        parts.append("smooth non-human head shape")
        if hair in {"mohawk", "top-knot", "hooded head", "spiky hair"}:
            parts.append(hair)
        if facial != "clean-shaven":
            parts.append(facial)
    else:
        if hair == "bald":
            parts.append("bald head")
        else:
            parts.append(hair)
        if facial != "clean-shaven":
            parts.append(facial)

    parts.append(eyes)
    parts.append(f"{expr} expression")
    if acc != "nothing on head":
        parts.append(f"wearing {acc}")

    return ", ".join(parts) + ", " + PROMPT_STYLE_SUFFIX


def legendary_prompt(token_id: int) -> Optional[str]:
    legendary = LEGENDARY_CHARACTERS.get(token_id)
    if not legendary:
        return None
    name, description = legendary
    from config import PROMPT_STYLE_SUFFIX
    return (
        f"Legendary 1/1 {name}, {description}, Loxleys collection character, "
        "distinct recognizable face silhouette, character-specific iconic accessory clearly visible, "
        "fine facial linework with separated eyes nose and mouth, premium one-of-one portrait, "
        f"{PROMPT_STYLE_SUFFIX}"
    )
