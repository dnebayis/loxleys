// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice On-chain decode of the 8-byte Loxleys trait combination produced by the
/// off-chain pipeline (D31). Byte layout mirrors pipeline/config.py TRAIT_CATEGORIES
/// and the label pools mirror pipeline/trait_names.py exactly:
///   0 Type(10) 1 Gender(3) 2 Age(3) 3 HairStyle(23) 4 FacialFeature(19)
///   5 Eyes(17) 6 Expression(9) 7 Accessory(20)
/// Used to build tokenURI attributes and the deterministic persona text (D16).
library LoxleysTraits {
    function typeName(uint8 v) internal pure returns (string memory) {
        if (v == 0) return "Human Scout";
        if (v == 1) return "Human Rogue";
        if (v == 2) return "Human Hacker";
        if (v == 3) return "Human Ranger";
        if (v == 4) return "Human Oracle";
        if (v == 5) return "Human Phantom";
        if (v == 6) return "Portrait Dog";
        if (v == 7) return "Portrait Cat";
        if (v == 8) return "Alien";
        return "Secret Agent";
    }

    function gender(uint8 v) internal pure returns (string memory) {
        if (v == 0) return "Masculine";
        if (v == 1) return "Feminine";
        return "Androgynous";
    }

    function age(uint8 v) internal pure returns (string memory) {
        if (v == 0) return "Young";
        if (v == 1) return "Adult";
        return "Elder";
    }

    function hair(uint8 v) internal pure returns (string memory) {
        if (v == 0) return "Bald";
        if (v == 1) return "Buzzcut";
        if (v == 2) return "Short";
        if (v == 3) return "Messy";
        if (v == 4) return "Spiky";
        if (v == 5) return "Curly";
        if (v == 6) return "Afro";
        if (v == 7) return "Wavy";
        if (v == 8) return "Long";
        if (v == 9) return "Bowl Cut";
        if (v == 10) return "Undercut";
        if (v == 11) return "Slicked-Back";
        if (v == 12) return "Mohawk";
        if (v == 13) return "Dreadlocks";
        if (v == 14) return "Cornrows";
        if (v == 15) return "Ponytail";
        if (v == 16) return "Top-Knot";
        if (v == 17) return "Man-Bun";
        if (v == 18) return "Bangs";
        if (v == 19) return "Pigtails";
        if (v == 20) return "Hooded";
        if (v == 21) return "Receding";
        return "Shaved Sides";
    }

    function facial(uint8 v) internal pure returns (string memory) {
        if (v == 0) return "Clean-Shaven";
        if (v == 1) return "Stubble";
        if (v == 2) return "Mustache";
        if (v == 3) return "Goatee";
        if (v == 4) return "Full Beard";
        if (v == 5) return "Sideburns";
        if (v == 6) return "Soul Patch";
        if (v == 7) return "Scarred Cheek";
        if (v == 8) return "Freckles";
        if (v == 9) return "Face Tattoo";
        if (v == 10) return "War Paint";
        if (v == 11) return "Cybernetic Jaw";
        if (v == 12) return "Nose Ring";
        if (v == 13) return "Eye Scar";
        if (v == 14) return "Beauty Mark";
        if (v == 15) return "Wrinkles";
        if (v == 16) return "Dimples";
        if (v == 17) return "Cheek Markings";
        return "Chin Strap Beard";
    }

    function eyes(uint8 v) internal pure returns (string memory) {
        if (v == 0) return "Normal";
        if (v == 1) return "Round Glasses";
        if (v == 2) return "Square Glasses";
        if (v == 3) return "Sunglasses";
        if (v == 4) return "Cyber Visor";
        if (v == 5) return "Glowing Cyber Eye";
        if (v == 6) return "Eyepatch";
        if (v == 7) return "Monocle";
        if (v == 8) return "Closed";
        if (v == 9) return "Winking";
        if (v == 10) return "Wide";
        if (v == 11) return "Narrow";
        if (v == 12) return "Glowing";
        if (v == 13) return "Heterochromia";
        if (v == 14) return "Tired";
        if (v == 15) return "Sharp Piercing";
        return "Big Round";
    }

    function expression(uint8 v) internal pure returns (string memory) {
        if (v == 0) return "Neutral";
        if (v == 1) return "Smiling";
        if (v == 2) return "Smirking";
        if (v == 3) return "Frowning";
        if (v == 4) return "Serious";
        if (v == 5) return "Surprised";
        if (v == 6) return "Grinning";
        if (v == 7) return "Scowling";
        return "Calm";
    }

    function accessory(uint8 v) internal pure returns (string memory) {
        if (v == 0) return "None";
        if (v == 1) return "Beanie";
        if (v == 2) return "Cap";
        if (v == 3) return "Hood";
        if (v == 4) return "Helmet";
        if (v == 5) return "Headphones";
        if (v == 6) return "Headband";
        if (v == 7) return "Bandana";
        if (v == 8) return "Glowing Halo";
        if (v == 9) return "Crown";
        if (v == 10) return "Small Horns";
        if (v == 11) return "Antenna";
        if (v == 12) return "Earring";
        if (v == 13) return "Neck Chain";
        if (v == 14) return "Scarf";
        if (v == 15) return "High Collar";
        if (v == 16) return "Face Mask";
        if (v == 17) return "Cigarette";
        if (v == 18) return "Flower";
        return "Laurel Wreath";
    }

    /// @dev OpenSea-style attributes array for the 8 trait bytes.
    function attributesJSON(bytes8 t) internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '[{"trait_type":"Type","value":"', typeName(uint8(t[0])),
                '"},{"trait_type":"Gender","value":"', gender(uint8(t[1])),
                '"},{"trait_type":"Age","value":"', age(uint8(t[2])),
                '"},{"trait_type":"Hair","value":"', hair(uint8(t[3])),
                '"},{"trait_type":"Facial Feature","value":"', facial(uint8(t[4])),
                '"},{"trait_type":"Eyes","value":"', eyes(uint8(t[5])),
                '"},{"trait_type":"Expression","value":"', expression(uint8(t[6])),
                '"},{"trait_type":"Accessory","value":"', accessory(uint8(t[7])),
                '"}]'
            )
        );
    }

    /// @dev Deterministic persona / "hafıza" text derived purely from the traits (D16).
    function personaText(uint256 tokenId, bytes8 t) internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                "Loxley #", _toString(tokenId), " is a ",
                age(uint8(t[2])), " ", gender(uint8(t[1])), " ", typeName(uint8(t[0])),
                " with ", hair(uint8(t[3])), " hair and ", eyes(uint8(t[5])),
                " eyes, wearing a ", expression(uint8(t[6])), " expression."
            )
        );
    }

    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { ++digits; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) { --digits; buffer[digits] = bytes1(uint8(48 + (value % 10))); value /= 10; }
        return string(buffer);
    }
}
