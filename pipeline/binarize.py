"""Image processing: resize to 40×40, convert to monochrome bitmap."""

from PIL import Image
import numpy as np
from io import BytesIO

from config import GRID_WIDTH, GRID_HEIGHT, BITMAP_BYTES, THRESHOLD


def load_image(source) -> Image.Image:
    """Load an image from bytes, file path, or file-like object."""
    if isinstance(source, bytes):
        return Image.open(BytesIO(source))
    elif isinstance(source, str):
        return Image.open(source)
    else:
        return Image.open(source)


def resize_to_grid(img: Image.Image) -> Image.Image:
    """Resize image to 40×40 using LANCZOS filter."""
    return img.resize((GRID_WIDTH, GRID_HEIGHT), Image.Resampling.LANCZOS)


def to_grayscale(img: Image.Image) -> Image.Image:
    """Convert image to grayscale (L mode)."""
    return img.convert("L")


def threshold_binarize(gray: Image.Image) -> np.ndarray:
    """
    Apply threshold binarization.
    
    Pixels with value > THRESHOLD → 0 (background/off-white)
    Pixels with value <= THRESHOLD → 1 (foreground/off-black)
    
    Returns a 40×40 numpy array of 0s and 1s.
    """
    arr = np.array(gray, dtype=np.uint8)
    # Below or equal threshold = foreground (1), above = background (0)
    binary = (arr <= THRESHOLD).astype(np.uint8)
    return binary


def pack_bitmap(binary: np.ndarray) -> bytes:
    """
    Pack a 40×40 binary array into 200 bytes.
    
    Format: MSB-first, row-major order.
    Each byte packs 8 consecutive pixels, with the first pixel
    in the most significant bit position.
    """
    # Flatten row-major
    flat = binary.flatten()
    assert len(flat) == GRID_WIDTH * GRID_HEIGHT, (
        f"Expected {GRID_WIDTH * GRID_HEIGHT} pixels, got {len(flat)}"
    )

    bitmap = bytearray(BITMAP_BYTES)
    for i, pixel in enumerate(flat):
        byte_index = i >> 3  # i // 8
        bit_pos = 7 - (i & 7)  # MSB-first
        if pixel:
            bitmap[byte_index] |= (1 << bit_pos)

    return bytes(bitmap)


def binarize_image(source) -> bytes:
    """
    Full pipeline: load image → resize → grayscale → threshold → pack.
    
    Args:
        source: Image bytes, file path, or file-like object.
        
    Returns:
        200-byte binary bitmap.
    """
    img = load_image(source)
    img = resize_to_grid(img)
    gray = to_grayscale(img)
    binary = threshold_binarize(gray)
    bitmap = pack_bitmap(binary)

    assert len(bitmap) == BITMAP_BYTES, (
        f"Bitmap must be exactly {BITMAP_BYTES} bytes, got {len(bitmap)}"
    )
    return bitmap
