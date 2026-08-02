// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library BitmapLib {
    uint256 internal constant WIDTH = 40;
    uint256 internal constant HEIGHT = 40;
    uint256 internal constant BYTE_LEN = 200;

    error OutOfBounds();

    function getPixel(bytes memory bitmap, uint256 x, uint256 y) internal pure returns (bool) {
        if (x >= WIDTH || y >= HEIGHT) revert OutOfBounds();
        uint256 bitIndex = y * WIDTH + x;
        uint256 byteIndex = bitIndex >> 3;
        uint256 bitOffset = 7 - (bitIndex & 7);
        return (uint8(bitmap[byteIndex]) >> bitOffset) & 1 == 1;
    }

    function setPixel(bytes memory bitmap, uint256 x, uint256 y, bool value) internal pure {
        if (x >= WIDTH || y >= HEIGHT) revert OutOfBounds();
        uint256 bitIndex = y * WIDTH + x;
        uint256 byteIndex = bitIndex >> 3;
        uint256 bitOffset = 7 - (bitIndex & 7);
        uint8 b = uint8(bitmap[byteIndex]);
        if (value) {
            b |= uint8(1 << bitOffset);
        } else {
            b &= ~uint8(1 << bitOffset);
        }
        bitmap[byteIndex] = bytes1(b);
    }

    function blank() internal pure returns (bytes memory bitmap) {
        bitmap = new bytes(BYTE_LEN);
    }

    function xor(bytes memory a, bytes memory b) internal pure returns (bytes memory result) {
        require(a.length == BYTE_LEN && b.length == BYTE_LEN, "bad length");
        result = new bytes(BYTE_LEN);
        assembly {
            let aPtr := add(a, 32)
            let bPtr := add(b, 32)
            let rPtr := add(result, 32)
            // 6 full 32-byte words (192 bytes)
            for { let i := 0 } lt(i, 192) { i := add(i, 32) } {
                mstore(add(rPtr, i), xor(mload(add(aPtr, i)), mload(add(bPtr, i))))
            }
            // Last 8 bytes: load 32 bytes at offset 168 (covers bytes 168..199 + overflow)
            // Only bytes 192..199 are new; 168..191 were already written but re-writing is harmless
            mstore(add(rPtr, 168), xor(mload(add(aPtr, 168)), mload(add(bPtr, 168))))
        }
    }

    function popcount(bytes memory bitmap) internal pure returns (uint256 count) {
        if (bitmap.length != BYTE_LEN) return 0;
        for (uint256 i; i < BYTE_LEN; ++i) {
            uint8 value = uint8(bitmap[i]);
            while (value != 0) {
                value &= value - 1;
                ++count;
            }
        }
    }

    function toSVG(bytes memory bitmap, string memory fillColor, uint256 scale)
        internal
        pure
        returns (string memory)
    {
        uint256 dim = WIDTH * scale;
        // A checkerboard is the most fragmented 40x40 bitmap: 20 runs per row,
        // 800 runs total. Write into one bounded buffer so rendering remains linear;
        // repeatedly concatenating the growing SVG makes the worst case quadratic.
        uint256 maxRuns = ((WIDTH + 1) / 2) * HEIGHT;
        bytes memory output = new bytes(256 + maxRuns * (80 + bytes(fillColor).length));
        uint256 cursor = _append(
            output,
            0,
            abi.encodePacked(
                "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ",
                _toString(dim),
                " ",
                _toString(dim),
                "' shape-rendering='crispEdges'>",
                "<rect width='100%' height='100%' fill='#0A0A0A'/>"
            )
        );
        for (uint256 y = 0; y < HEIGHT; ++y) {
            uint256 x = 0;
            while (x < WIDTH) {
                if (getPixel(bitmap, x, y)) {
                    uint256 runStart = x;
                    uint256 runLen = 0;
                    while (x < WIDTH && getPixel(bitmap, x, y)) {
                        ++runLen;
                        ++x;
                    }
                    cursor = _append(
                        output,
                        cursor,
                        abi.encodePacked(
                            "<rect x='",
                            _toString(runStart * scale),
                            "' y='",
                            _toString(y * scale),
                            "' width='",
                            _toString(runLen * scale),
                            "' height='",
                            _toString(scale),
                            "' fill='",
                            fillColor,
                            "'/>"
                        )
                    );
                } else {
                    ++x;
                }
            }
        }
        cursor = _append(output, cursor, bytes("</svg>"));
        assembly {
            mstore(output, cursor)
        }
        return string(output);
    }

    function _append(bytes memory output, uint256 cursor, bytes memory value)
        private
        pure
        returns (uint256)
    {
        uint256 end = cursor + value.length;
        // Word-copy into the preallocated buffer. The extra word of required slack keeps the
        // final partial-word write inside the allocation; the logical length is trimmed later.
        require(end + 31 <= output.length, "SVG buffer overflow");
        assembly ("memory-safe") {
            let source := add(value, 0x20)
            let target := add(add(output, 0x20), cursor)
            let length := mload(value)
            for { let offset := 0 } lt(offset, length) { offset := add(offset, 0x20) } {
                mstore(add(target, offset), mload(add(source, offset)))
            }
        }
        return end;
    }

    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            ++digits;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            --digits;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
