// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721SeaDrop} from "seadrop/src/ERC721SeaDrop.sol";
import {SSTORE2} from "solady/utils/SSTORE2.sol";
import {Base64} from "solady/utils/Base64.sol";
import {LibString} from "solady/utils/LibString.sol";
import {BitmapLib} from "./lib/BitmapLib.sol";
import {LoxleysTraits} from "./lib/LoxleysTraits.sol";

interface ILoxleysCanvas {
    function overlayOf(uint256 tokenId) external view returns (bytes memory);
    function isSealed(uint256 tokenId) external view returns (bool);
    function alteredPixels(uint256 tokenId) external view returns (uint16);
    function isOutlawActive(uint256 tokenId) external view returns (bool);
}

interface ILoxleysExtensions {
    function memoriesSuffix(uint256 tokenId) external view returns (string memory);
    function attributesFragment(uint256 tokenId) external view returns (string memory);
}

interface ILoxleysRenderer {
    function tokenURI(uint256 tokenId) external view returns (string memory);
    function personaOf(uint256 tokenId) external view returns (string memory);
}

/// @notice Loxleys — a 2,000-supply, fully on-chain Agent NFT collection
/// on Robinhood Chain (D13). Art is pre-generated off-chain (Flux Dev pipeline, D31),
/// binarized to 200-byte 1-bit bitmaps, and uploaded on-chain in batches (SSTORE2,
/// Normies' stored-bitmap model). Each token renders as a phosphor-green (#CDFF00)
/// pixel portrait on a black canvas (D30). Post-mint edits live in a separate Canvas.
contract LoxleysArt is ERC721SeaDrop {
    using LibString for uint256;

    uint256 public constant MAX_SUPPLY = 2_000;
    uint256 public constant SPECIAL_RESERVE = 0;
    uint256 public constant PUBLIC_SUPPLY = MAX_SUPPLY;
    uint96 public constant ROYALTY_BPS = 250; // 2.5%, D19
    uint256 public constant NAMED_RARE_START = 1_990;
    uint256 public constant NAMED_RARE_COUNT = 10;

    uint256 public constant BATCH_SIZE = 100; // art slots per SSTORE2 blob
    uint256 public constant NUM_BATCHES = MAX_SUPPLY / BATCH_SIZE; // 20
    string internal constant ART_COLOR = "#CDFF00"; // D22, flat green (no depth, D30)

    ILoxleysCanvas public canvas;
    ILoxleysExtensions public extensions;
    ILoxleysRenderer public renderer;
    string public animationBaseURI;

    // One-time owner-triggered reveal offset. This is intentionally not a VRF: the owner can
    // choose the offset, but cannot change it after reveal.
    uint256 public startIndex;
    bool public startIndexSet;
    bool public mintClosed;
    mapping(uint256 => uint64) public ownershipEpoch;

    // Batched storage: each blob concatenates BATCH_SIZE entries.
    mapping(uint256 => address) internal _artBatch;    // 200 bytes/entry
    mapping(uint256 => address) internal _traitBatch;  // 8 bytes/entry
    mapping(uint256 => string) internal _specialPersona;
    mapping(uint256 => string) internal _specialName;
    mapping(uint256 => bytes8) internal _traitOverride;
    mapping(uint256 => bool) internal _traitOverrideSet;
    bool public traitOverridesLocked;

    event ArtUploaded(uint256 indexed batchIndex);
    event StartIndexRevealed(uint256 startIndex);
    event MintClosed(uint256 finalMintedSupply);
    event MetadataUpdate(uint256 indexed tokenId);
    event AnimationBaseURISet(string baseURI);
    event RendererSet(address indexed renderer);
    event SpecialMetadataSet(uint256 indexed tokenId, string displayName, bytes8 traits);
    event TraitOverrideSet(uint256 indexed tokenId, bytes8 traits);
    event TraitOverridesLocked();

    error MintingClosed();
    error MintingStillOpen();
    error NoMintedSupply();
    error InvalidTokenId();
    error InvalidArtSlot();
    error InvalidNamedRareSlot();
    error BadOverrideInput();
    error TraitOverridesLockedError();
    error MetadataNotLocked();
    error SpecialMetadataIncomplete();
    error InsufficientMintedSupply();
    error NamedRareUnassigned();
    error BadBatchLength();
    error BatchAlreadyUploaded();
    error ArtNotUploaded();
    error CanvasAlreadySet();
    error ExtensionsAlreadySet();
    error RendererAlreadySet();
    error RendererNotSet();
    error AlreadyRevealed();
    error ArtUploadIncomplete();
    error RevealNotSet();
    error NotCanvas();

    constructor(address initialOwner, address[] memory allowedSeaDrop)
        ERC721SeaDrop("Loxleys", "LOXLEY", allowedSeaDrop)
    {
        if (initialOwner != msg.sender) _transferOwnership(initialOwner);
        _maxSupply = MAX_SUPPLY;
        _royaltyInfo.royaltyAddress = initialOwner;
        _royaltyInfo.royaltyBps = ROYALTY_BPS;
    }

    // ---------------------------------------------------------------- admin/upload

    /// @notice Uploads one full batch of pre-generated art + traits (owner only).
    /// `bitmaps` = BATCH_SIZE * 200 bytes, `traits` = BATCH_SIZE * 8 bytes.
    function uploadArt(uint256 batchIndex, bytes calldata bitmaps, bytes calldata traits)
        external
        onlyOwner
    {
        if (batchIndex >= NUM_BATCHES) revert BadBatchLength();
        if (bitmaps.length != BATCH_SIZE * BitmapLib.BYTE_LEN) revert BadBatchLength();
        if (traits.length != BATCH_SIZE * 8) revert BadBatchLength();
        if (_artBatch[batchIndex] != address(0)) revert BatchAlreadyUploaded();

        _artBatch[batchIndex] = SSTORE2.write(bitmaps);
        _traitBatch[batchIndex] = SSTORE2.write(traits);
        emit ArtUploaded(batchIndex);
    }

    /// @notice Permanently reveals the collection with an owner-selected offset.
    /// @dev The owner can choose the distribution. The offset is immutable once set and reveal
    /// remains blocked until minting is irreversibly closed and all art batches are uploaded.
    function reveal(uint256 offset) external onlyOwner {
        if (startIndexSet) revert AlreadyRevealed();
        if (!mintClosed) revert MintingStillOpen();
        if (!traitOverridesLocked) revert MetadataNotLocked();
        if (offset >= MAX_SUPPLY) revert InvalidArtSlot();
        for (uint256 i; i < NUM_BATCHES; ++i) {
            if (_artBatch[i] == address(0)) revert ArtUploadIncomplete();
        }
        uint256 minted = _totalMinted();
        for (uint256 i; i < NAMED_RARE_COUNT; ++i) {
            uint256 rareSlot = NAMED_RARE_START + i;
            uint256 mappedTokenId = ((rareSlot + MAX_SUPPLY - offset) % MAX_SUPPLY) + 1;
            if (mappedTokenId > minted) revert NamedRareUnassigned();
        }
        startIndex = offset;
        startIndexSet = true;
        emit StartIndexRevealed(offset);
        emit BatchMetadataUpdate(1, MAX_SUPPLY);
    }

    /// @notice Irreversibly closes SeaDrop minting so the post-sale reveal can begin.
    function closeMintingForReveal() external onlyOwner {
        if (mintClosed) revert MintingClosed();
        if (_totalMinted() == 0) revert NoMintedSupply();
        if (_totalMinted() < NAMED_RARE_COUNT) revert InsufficientMintedSupply();
        mintClosed = true;
        emit MintClosed(_totalMinted());
    }

    /// @dev One-time wiring of the Canvas contract (deployed after this one).
    function setCanvas(address canvasAddress) external onlyOwner {
        if (address(canvas) != address(0)) revert CanvasAlreadySet();
        canvas = ILoxleysCanvas(canvasAddress);
    }

    /// @dev One-time wiring of the AgentExtensions contract (D33). When set, tokenURI
    /// surfaces the agent's memories in the description and equipped capabilities +
    /// alliance/memory counts in the attributes.
    function setExtensions(address extensionsAddress) external onlyOwner {
        if (address(extensions) != address(0)) revert ExtensionsAlreadySet();
        extensions = ILoxleysExtensions(extensionsAddress);
    }

    function setRenderer(address rendererAddress) external onlyOwner {
        if (address(renderer) != address(0)) revert RendererAlreadySet();
        if (rendererAddress == address(0)) revert RendererNotSet();
        renderer = ILoxleysRenderer(rendererAddress);
        emit RendererSet(rendererAddress);
    }

    /// @notice Updates only the optional hosted Public/Outlaw comparison URL.
    /// The on-chain portrait and sealed overlay are unaffected.
    function setAnimationBaseURI(string calldata baseURI) external onlyOwner {
        animationBaseURI = baseURI;
        emit AnimationBaseURISet(baseURI);
        emit BatchMetadataUpdate(1, MAX_SUPPLY);
    }

    /// @dev Called by the configured Canvas or Extensions module after metadata changes.
    function notifyMetadataUpdate(uint256 tokenId) external {
        if (msg.sender != address(canvas) && msg.sender != address(extensions)) revert NotCanvas();
        emit MetadataUpdate(tokenId);
    }

    function setSpecialPersona(uint256 artSlot, string calldata persona) external onlyOwner {
        if (traitOverridesLocked) revert TraitOverridesLockedError();
        _validateNamedRareSlot(artSlot);
        _specialPersona[artSlot] = persona;
    }

    function setSpecialMetadata(uint256 artSlot, string calldata displayName, string calldata persona)
        external
        onlyOwner
    {
        if (traitOverridesLocked) revert TraitOverridesLockedError();
        _validateNamedRareSlot(artSlot);
        _specialName[artSlot] = displayName;
        _specialPersona[artSlot] = persona;
        emit SpecialMetadataSet(artSlot, displayName, _traitOverride[artSlot]);
    }

    function setSpecialMetadata(
        uint256 artSlot,
        string calldata displayName,
        string calldata persona,
        bytes8 traits
    ) external onlyOwner {
        if (traitOverridesLocked) revert TraitOverridesLockedError();
        _validateNamedRareSlot(artSlot);
        _specialName[artSlot] = displayName;
        _specialPersona[artSlot] = persona;
        _setTraitOverride(artSlot, traits);
        emit SpecialMetadataSet(artSlot, displayName, traits);
    }

    function setSpecialTraits(uint256 artSlot, bytes8 traits) external onlyOwner {
        _validateNamedRareSlot(artSlot);
        _setTraitOverride(artSlot, traits);
        emit SpecialMetadataSet(artSlot, _specialName[artSlot], traits);
    }

    function setTraitOverride(uint256 artSlot, bytes8 traits) external onlyOwner {
        _setTraitOverride(artSlot, traits);
    }

    function setTraitOverrides(uint256[] calldata tokenIds, bytes8[] calldata traits) external onlyOwner {
        if (tokenIds.length != traits.length) revert BadOverrideInput();
        for (uint256 i = 0; i < tokenIds.length; ++i) {
            _setTraitOverride(tokenIds[i], traits[i]);
        }
    }

    function lockTraitOverrides() external onlyOwner {
        for (uint256 i; i < NAMED_RARE_COUNT; ++i) {
            uint256 rareSlot = NAMED_RARE_START + i;
            if (bytes(_specialName[rareSlot]).length == 0 || !_traitOverrideSet[rareSlot]) {
                revert SpecialMetadataIncomplete();
            }
        }
        traitOverridesLocked = true;
        emit TraitOverridesLocked();
    }

    function specialNameOf(uint256 tokenId) external view returns (string memory) {
        return _specialName[slotOf(tokenId)];
    }

    function specialPersonaOf(uint256 tokenId) external view returns (string memory) {
        return _specialPersona[slotOf(tokenId)];
    }

    function specialTraitsOf(uint256 tokenId) external view returns (bytes8 traits, bool configured) {
        uint256 slot = slotOf(tokenId);
        if (bytes(_specialName[slot]).length == 0) revert InvalidArtSlot();
        return (_traitOverride[slot], _traitOverrideSet[slot]);
    }

    function traitOverrideOf(uint256 tokenId) external view returns (bytes8 traits, bool configured) {
        uint256 slot = slotOf(tokenId);
        return (_traitOverride[slot], _traitOverrideSet[slot]);
    }

    function withdraw(address to) external onlyOwner {
        (bool ok,) = to.call{value: address(this).balance}("");
        require(ok, "withdraw failed");
    }

    // ---------------------------------------------------------------- SeaDrop minting

    function mintSeaDrop(address minter, uint256 quantity) external override nonReentrant {
        _onlyAllowedSeaDrop(msg.sender);
        if (mintClosed) revert MintingClosed();
        for (uint256 i; i < NUM_BATCHES; ++i) {
            if (_artBatch[i] == address(0)) revert ArtUploadIncomplete();
        }
        if (_totalMinted() + quantity > MAX_SUPPLY) {
            revert MintQuantityExceedsMaxSupply(_totalMinted() + quantity, MAX_SUPPLY);
        }
        _safeMint(minter, quantity);
    }

    /// @dev Every mint/transfer advances the token's authorization epoch. Canvas delegates and
    /// pending alliance requests bind to this value, so permissions cannot revive if a token
    /// later returns to a previous owner.
    function _afterTokenTransfers(address from, address to, uint256 startTokenId, uint256 quantity)
        internal
        override
    {
        super._afterTokenTransfers(from, to, startTokenId, quantity);
        if (from == to) return;
        for (uint256 i; i < quantity; ++i) {
            unchecked {
                ++ownershipEpoch[startTokenId + i];
            }
        }
    }

    // ---------------------------------------------------------------- reads

    /// @notice Current minted supply, exposed for explorers and NFT indexers.
    function isSpecial(uint256 tokenId) public view returns (bool) {
        if (!startIndexSet) return false;
        return bytes(_specialName[slotOf(tokenId)]).length != 0;
    }

    function isBatchUploaded(uint256 batchIndex) external view returns (bool) {
        return _artBatch[batchIndex] != address(0);
    }

    /// @dev The immutable art slot (0-indexed) a token maps to. Public tokens are
    /// shuffled by `startIndex`; specials map 1:1.
    function slotOf(uint256 tokenId) public view returns (uint256) {
        _validateTokenId(tokenId);
        if (!startIndexSet) revert RevealNotSet();
        unchecked {
            return (tokenId - 1 + startIndex) % MAX_SUPPLY;
        }
    }

    function _requireArt(uint256 tokenId) internal view {
        if (_artBatch[slotOf(tokenId) / BATCH_SIZE] == address(0)) revert ArtNotUploaded();
    }

    /// @dev The immutable base bitmap as uploaded, before any Canvas overlay (D23).
    function baseBitmap(uint256 tokenId) public view returns (bytes memory) {
        uint256 slot = slotOf(tokenId);
        address ptr = _artBatch[slot / BATCH_SIZE];
        if (ptr == address(0)) revert ArtNotUploaded();
        uint256 offset = (slot % BATCH_SIZE) * BitmapLib.BYTE_LEN;
        return SSTORE2.read(ptr, offset, offset + BitmapLib.BYTE_LEN);
    }

    function traitsOf(uint256 tokenId) public view returns (bytes8 out) {
        uint256 slot = slotOf(tokenId);
        if (_traitOverrideSet[slot]) return _traitOverride[slot];
        address ptr = _traitBatch[slot / BATCH_SIZE];
        if (ptr == address(0)) return bytes8(0);
        uint256 offset = (slot % BATCH_SIZE) * 8;
        bytes memory b = SSTORE2.read(ptr, offset, offset + 8);
        assembly {
            out := mload(add(b, 32))
        }
    }

    function _setTraitOverride(uint256 artSlot, bytes8 traits) internal {
        if (traitOverridesLocked) revert TraitOverridesLockedError();
        _validateArtSlot(artSlot);
        _traitOverride[artSlot] = traits;
        _traitOverrideSet[artSlot] = true;
        emit TraitOverrideSet(artSlot, traits);
    }

    function _validateTokenId(uint256 tokenId) internal pure {
        if (tokenId == 0 || tokenId > MAX_SUPPLY) revert InvalidTokenId();
    }

    function _validateArtSlot(uint256 artSlot) internal pure {
        if (artSlot >= MAX_SUPPLY) revert InvalidArtSlot();
    }

    function _validateNamedRareSlot(uint256 artSlot) internal pure {
        if (artSlot < NAMED_RARE_START || artSlot >= NAMED_RARE_START + NAMED_RARE_COUNT) {
            revert InvalidNamedRareSlot();
        }
    }

    /// @dev The permanently sealed Outlaw bitmap, independent of active display identity.
    function outlawBitmap(uint256 tokenId) public view returns (bytes memory bmp) {
        bmp = baseBitmap(tokenId);
        if (isOutlawSealed(tokenId)) {
            bytes memory overlay = canvas.overlayOf(tokenId);
            if (overlay.length == BitmapLib.BYTE_LEN) {
                bmp = BitmapLib.xor(bmp, overlay);
            }
        }
    }

    /// @dev The bitmap currently exposed by tokenURI and marketplace metadata.
    function renderedBitmap(uint256 tokenId) public view returns (bytes memory) {
        return isOutlawActive(tokenId) ? outlawBitmap(tokenId) : baseBitmap(tokenId);
    }

    function isOutlawSealed(uint256 tokenId) public view returns (bool) {
        return address(canvas) != address(0) && canvas.isSealed(tokenId);
    }

    function isOutlawActive(uint256 tokenId) public view returns (bool) {
        return isOutlawSealed(tokenId) && canvas.isOutlawActive(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        if (address(renderer) == address(0)) revert RendererNotSet();
        return renderer.tokenURI(tokenId);
    }

    function personaOf(uint256 tokenId) external view returns (string memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        if (!startIndexSet) revert RevealNotSet();
        if (address(renderer) == address(0)) revert RendererNotSet();
        return renderer.personaOf(tokenId);
    }

    /// @dev Base trait attributes, plus capability/alliance/memory entries spliced in from
    /// AgentExtensions when wired (D33).
    function _attributes(uint256 tokenId) internal view returns (string memory) {
        bytes8 traits = traitsOf(tokenId);
        uint256 slot = slotOf(tokenId);
        string memory base = LoxleysTraits.attributesJSON(traits);
        bytes memory b0 = bytes(base);
        bytes memory head0 = new bytes(b0.length - 1);
        for (uint256 i = 0; i < b0.length - 1; ++i) head0[i] = b0[i];

        if (isSpecial(tokenId)) {
            base = string(
                abi.encodePacked(
                    head0,
                    ',{"trait_type":"Rarity","value":"Named Rare"}',
                    ',{"trait_type":"Edition","value":"1/1"}',
                    ',{"trait_type":"Named Character","value":"',
                    _escapeJSON(_specialName[slot]),
                    '"}]'
                )
            );
        } else {
            string memory rarity = uint8(traits[0]) >= 6 ? "Rare" : "Common";
            base = string(abi.encodePacked(head0, ',{"trait_type":"Rarity","value":"', rarity, '"}]'));
        }
        bool outlawSealed = isOutlawSealed(tokenId);
        bool outlawActive = isOutlawActive(tokenId);
        uint256 changed = outlawSealed ? canvas.alteredPixels(tokenId) : 0;
        bytes memory withCanvasHead = bytes(base);
        bytes memory canvasHead = new bytes(withCanvasHead.length - 1);
        for (uint256 i = 0; i < withCanvasHead.length - 1; ++i) canvasHead[i] = withCanvasHead[i];
        base = string(
            abi.encodePacked(
                canvasHead,
                ',{"trait_type":"Identity","value":"',
                outlawActive ? "Outlaw" : "Public",
                '"},{"trait_type":"Canvas Status","value":"',
                outlawSealed ? "Sealed" : "Unsealed",
                '"},{"display_type":"number","trait_type":"Altered Pixels","value":',
                changed.toString(),
                "}]"
            )
        );

        if (address(extensions) == address(0)) return base;
        string memory frag = extensions.attributesFragment(tokenId);
        if (bytes(frag).length == 0) return base;
        // splice `frag` (comma-prefixed entries) before the closing "]" of `base`.
        bytes memory b = bytes(base);
        bytes memory head = new bytes(b.length - 1);
        for (uint256 i = 0; i < b.length - 1; ++i) {
            head[i] = b[i];
        }
        return string(abi.encodePacked(head, frag, "]"));
    }

    function _tokenName(uint256 tokenId) internal view returns (string memory) {
        uint256 slot = slotOf(tokenId);
        if (bytes(_specialName[slot]).length != 0) {
            return string(abi.encodePacked(_specialName[slot], " // Loxley #", tokenId.toString()));
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
                image,
                '","attributes":[{"trait_type":"Status","value":"Unrevealed"}]}'
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function _escapeJSON(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out = new bytes(b.length * 2);
        uint256 j;
        for (uint256 i = 0; i < b.length; ++i) {
            if (b[i] == '"' || b[i] == "\\") {
                out[j++] = "\\";
            }
            out[j++] = b[i];
        }
        bytes memory trimmed = new bytes(j);
        for (uint256 k = 0; k < j; ++k) {
            trimmed[k] = out[k];
        }
        return string(trimmed);
    }

}
