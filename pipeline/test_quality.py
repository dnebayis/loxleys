import unittest

from quality import MAX_FOREGROUND_PIXELS, MIN_FOREGROUND_PIXELS, inspect_bitmap


def bitmap_with_foreground(count: int) -> bytes:
    bits = [0] * 1600
    positions = list(range(0, 1600, 2)) + list(range(1, 1600, 2))
    for position in positions[:count]:
        bits[position] = 1
    return bytes(sum(bits[offset + bit] << (7 - bit) for bit in range(8)) for offset in range(0, 1600, 8))


class QualityTest(unittest.TestCase):
    def test_accepts_density_boundaries(self):
        self.assertTrue(inspect_bitmap(bitmap_with_foreground(MIN_FOREGROUND_PIXELS)).accepted)
        self.assertTrue(inspect_bitmap(bitmap_with_foreground(MAX_FOREGROUND_PIXELS)).accepted)

    def test_rejects_sparse_and_dense_bitmaps(self):
        self.assertEqual(inspect_bitmap(bitmap_with_foreground(MIN_FOREGROUND_PIXELS - 1)).reason, "foreground_too_sparse")
        self.assertEqual(inspect_bitmap(bitmap_with_foreground(MAX_FOREGROUND_PIXELS + 1)).reason, "foreground_too_dense")

    def test_rejects_invalid_length(self):
        self.assertEqual(inspect_bitmap(b"bad").reason, "invalid_length:3")

    def test_rejects_solid_silhouette_without_internal_detail(self):
        solid = bytes([0xff] * 75 + [0x00] * 125)
        self.assertEqual(inspect_bitmap(solid).reason, "insufficient_internal_detail")


if __name__ == "__main__":
    unittest.main()
