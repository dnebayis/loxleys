// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base64} from "solady/utils/Base64.sol";
import {LibString} from "solady/utils/LibString.sol";
import {BitmapLib} from "./lib/BitmapLib.sol";
import {LoxleysTraits} from "./lib/LoxleysTraits.sol";

interface IRendererArt {
    function startIndexSet() external view returns (bool);
    function renderedBitmap(uint256 tokenId) external view returns (bytes memory);
    function traitsOf(uint256 tokenId) external view returns (bytes8);
    function isSpecial(uint256 tokenId) external view returns (bool);
    function isOutlawSealed(uint256 tokenId) external view returns (bool);
    function isOutlawActive(uint256 tokenId) external view returns (bool);
    function specialNameOf(uint256 tokenId) external view returns (string memory);
    function specialPersonaOf(uint256 tokenId) external view returns (string memory);
    function canvas() external view returns (address);
    function extensions() external view returns (address);
    function animationBaseURI() external view returns (string memory);
}

interface IRendererCanvas {
    function alteredPixels(uint256 tokenId) external view returns (uint16);
}

interface IRendererExtensions {
    function memoriesSuffix(uint256 tokenId) external view returns (string memory);
    function attributesFragment(uint256 tokenId) external view returns (string memory);
}

/// @notice Stateless on-chain SVG/JSON renderer kept separate to keep the SeaDrop token deployable.
contract LoxleysRenderer {
    using LibString for uint256;

    IRendererArt public immutable art;
    string internal constant ART_COLOR = "#CDFF00";

    constructor(address artAddress) {
        art = IRendererArt(artAddress);
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (!art.startIndexSet()) return _placeholderTokenURI();
        string memory svg = BitmapLib.toSVG(art.renderedBitmap(tokenId), ART_COLOR, 20);
        string memory image = string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svg))));

        string memory description = personaOf(tokenId);
        address extensionsAddress = art.extensions();
        if (extensionsAddress != address(0)) {
            description = string(
                abi.encodePacked(description, IRendererExtensions(extensionsAddress).memoriesSuffix(tokenId))
            );
        }

        string memory animationBaseURI = art.animationBaseURI();
        string memory animation = bytes(animationBaseURI).length == 0
            ? ""
            : string(
                abi.encodePacked(
                    ',"animation_url":"', _escapeJSON(animationBaseURI), "/tokens/", tokenId.toString(), '/identity"'
                )
            );
        string memory json = string(
            abi.encodePacked(
                '{"name":"', _escapeJSON(_tokenName(tokenId)), '","description":"',
                _escapeJSON(description), '","image":"', image, '"', animation,
                ',"attributes":', _attributes(tokenId), "}"
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function personaOf(uint256 tokenId) public view returns (string memory) {
        string memory specialPersona = art.specialPersonaOf(tokenId);
        return bytes(specialPersona).length == 0
            ? LoxleysTraits.personaText(tokenId, art.traitsOf(tokenId))
            : specialPersona;
    }

    function _attributes(uint256 tokenId) internal view returns (string memory) {
        bytes8 traits = art.traitsOf(tokenId);
        string memory base = LoxleysTraits.attributesJSON(traits);
        bytes memory baseBytes = bytes(base);
        bytes memory head = new bytes(baseBytes.length - 1);
        for (uint256 i; i < baseBytes.length - 1; ++i) head[i] = baseBytes[i];

        if (art.isSpecial(tokenId)) {
            base = string(
                abi.encodePacked(
                    head,
                    ',{"trait_type":"Rarity","value":"Named Rare"}',
                    ',{"trait_type":"Edition","value":"1/1"}',
                    ',{"trait_type":"Named Character","value":"',
                    _escapeJSON(art.specialNameOf(tokenId)),
                    '"}]'
                )
            );
        } else {
            string memory rarity = uint8(traits[0]) >= 6 ? "Rare" : "Common";
            base = string(abi.encodePacked(head, ',{"trait_type":"Rarity","value":"', rarity, '"}]'));
        }

        bool outlawSealed = art.isOutlawSealed(tokenId);
        bool active = art.isOutlawActive(tokenId);
        address canvasAddress = art.canvas();
        uint256 changed = outlawSealed && canvasAddress != address(0)
            ? IRendererCanvas(canvasAddress).alteredPixels(tokenId)
            : 0;
        bytes memory withCanvas = bytes(base);
        bytes memory canvasHead = new bytes(withCanvas.length - 1);
        for (uint256 i; i < withCanvas.length - 1; ++i) canvasHead[i] = withCanvas[i];
        base = string(
            abi.encodePacked(
                canvasHead,
                ',{"trait_type":"Identity","value":"', active ? "Outlaw" : "Public",
                '"},{"trait_type":"Canvas Status","value":"', outlawSealed ? "Sealed" : "Unsealed",
                '"},{"display_type":"number","trait_type":"Altered Pixels","value":', changed.toString(), "}]"
            )
        );

        if (extensionsAddress() == address(0)) return base;
        string memory fragment = IRendererExtensions(extensionsAddress()).attributesFragment(tokenId);
        if (bytes(fragment).length == 0) return base;
        bytes memory assembled = bytes(base);
        bytes memory withoutClose = new bytes(assembled.length - 1);
        for (uint256 i; i < assembled.length - 1; ++i) withoutClose[i] = assembled[i];
        return string(abi.encodePacked(withoutClose, fragment, "]"));
    }

    function extensionsAddress() internal view returns (address) {
        return art.extensions();
    }

    function _tokenName(uint256 tokenId) internal view returns (string memory) {
        string memory specialName = art.specialNameOf(tokenId);
        if (bytes(specialName).length != 0) {
            return string(abi.encodePacked(specialName, " // Loxley #", tokenId.toString()));
        }
        return string(abi.encodePacked("Loxley #", tokenId.toString()));
    }

    function _placeholderTokenURI() internal pure returns (string memory) {
        string memory svg = string(
            abi.encodePacked(
                "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 800' shape-rendering='crispEdges'>",
                "<rect width='800' height='800' fill='#0A0A0A'/>",
                "<text x='400' y='390' fill='#CDFF00' text-anchor='middle' font-family='monospace' font-size='42'>LOXLEYS</text>",
                "<text x='400' y='450' fill='#CDFF00' text-anchor='middle' font-family='monospace' font-size='22'>AWAITING FINAL REVEAL</text></svg>"
            )
        );
        string memory image = string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svg))));
        string memory json = string(
            abi.encodePacked(
                '{"name":"Loxleys - Unrevealed","description":"Minted through SeaDrop. Final on-chain identity awaits the one-time owner-triggered reveal.","image":"',
                image, '","attributes":[{"trait_type":"Status","value":"Unrevealed"}]}'
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function _escapeJSON(string memory value) internal pure returns (string memory) {
        bytes memory input = bytes(value);
        bytes memory output = new bytes(input.length * 2);
        uint256 length;
        for (uint256 i; i < input.length; ++i) {
            if (input[i] == '"' || input[i] == "\\") output[length++] = "\\";
            output[length++] = input[i];
        }
        bytes memory trimmed = new bytes(length);
        for (uint256 i; i < length; ++i) trimmed[i] = output[i];
        return string(trimmed);
    }
}
