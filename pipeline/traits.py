"""Trait assignment: deterministic from seed + uniqueness check."""

import random
from typing import Set, Optional

from config import TRAIT_CATEGORIES, MAX_RETRIES, TYPE_WEIGHTS


def generate_traits(seed: int, existing_traits: Set[bytes]) -> bytes:
    """
    Generate a unique 8-byte trait combination.
    
    Uses the seed to deterministically generate traits within valid ranges.
    Checks uniqueness against the existing set and retries with modified
    seeds if a duplicate is found (up to MAX_RETRIES attempts).
    
    Args:
        seed: Random seed for trait generation.
        existing_traits: Set of already-used trait combinations (as bytes).
        
    Returns:
        8-byte trait combination (bytes of length 8).
        
    Raises:
        RuntimeError: If unable to generate unique traits after MAX_RETRIES attempts.
    """
    for attempt in range(MAX_RETRIES):
        rng = random.Random(seed + attempt)
        trait_bytes = bytearray(8)

        for i, (name, max_val) in enumerate(TRAIT_CATEGORIES):
            if name == "Type":
                trait_bytes[i] = rng.choices(
                    range(max_val + 1),
                    weights=TYPE_WEIGHTS,
                    k=1,
                )[0]
            else:
                trait_bytes[i] = rng.randint(0, max_val)

        result = bytes(trait_bytes)
        if result not in existing_traits:
            return result

    raise RuntimeError(
        f"Failed to generate unique traits after {MAX_RETRIES} attempts "
        f"(seed={seed}, existing={len(existing_traits)} combinations)"
    )


def validate_traits(traits: bytes) -> bool:
    """
    Validate that each trait byte is within the valid range for its category.
    
    Args:
        traits: 8-byte trait combination.
        
    Returns:
        True if all traits are valid, False otherwise.
    """
    if len(traits) != 8:
        return False

    for i, (name, max_val) in enumerate(TRAIT_CATEGORIES):
        if traits[i] > max_val:
            return False

    return True


def traits_to_hex(traits: bytes) -> str:
    """Convert 8-byte traits to hex string (e.g., '0x0102000a05030201')."""
    return "0x" + traits.hex()


def hex_to_traits(hex_str: str) -> bytes:
    """Convert hex string back to 8-byte traits."""
    if hex_str.startswith("0x"):
        hex_str = hex_str[2:]
    return bytes.fromhex(hex_str)
