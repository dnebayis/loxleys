// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "solady/auth/Ownable.sol";
import {SSTORE2} from "solady/utils/SSTORE2.sol";
import {BitmapLib} from "./lib/BitmapLib.sol";

interface ILoxleysArt {
    function ownerOf(uint256 tokenId) external view returns (address);
    function ownershipEpoch(uint256 tokenId) external view returns (uint64);
    function notifyMetadataUpdate(uint256 tokenId) external;
    function startIndexSet() external view returns (bool);
}

/// @notice Write-once Outlaw identity layer for Loxleys. The original portrait
/// remains immutable in LoxleysArt; sealing stores a permanent XOR overlay.
contract LoxleysCanvas is Ownable {
    uint256 public constant MAX_ALTERED_PIXELS = 256;
    uint256 public constant MAX_PRIVILEGED_ARTIST_PIXELS = 1_600;

    struct DelegateGrant {
        address delegate;
        address grantor;
        uint64 epoch;
    }

    ILoxleysArt public immutable art;
    address public immutable privilegedArtist;
    bool public paused;

    mapping(uint256 => address) internal _overlayPointer;
    mapping(uint256 => uint16) internal _alteredPixels;
    mapping(uint256 => bytes32) internal _overlayHash;
    mapping(uint256 => DelegateGrant) internal _delegateGrant;
    mapping(uint256 => bool) internal _outlawActive;

    event OutlawSealed(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed sealedBy,
        uint16 alteredPixels,
        bytes32 overlayHash
    );
    event DelegateSet(uint256 indexed tokenId, address indexed owner, address indexed delegate);
    event ActiveIdentitySet(uint256 indexed tokenId, address indexed owner, bool outlawActive);

    error Paused();
    error NotAuthorized();
    error AlreadySealed();
    error EmptyOverlay();
    error TooManyPixels();
    error InvalidOverlayLength();
    error OutlawNotSealed();
    error IdentityUnchanged();
    error RevealNotSet();

    constructor(address artAddress, address initialOwner) {
        art = ILoxleysArt(artAddress);
        privilegedArtist = initialOwner;
        _initializeOwner(initialOwner);
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
    }

    /// @notice Returns the active delegate. A transfer invalidates the grant
    /// because the current owner no longer matches the grantor snapshot.
    function delegateOf(uint256 tokenId) public view returns (address) {
        DelegateGrant memory grant = _delegateGrant[tokenId];
        if (grant.delegate == address(0)) return address(0);
        try art.ownerOf(tokenId) returns (address currentOwner) {
            return currentOwner == grant.grantor && art.ownershipEpoch(tokenId) == grant.epoch
                ? grant.delegate
                : address(0);
        } catch {
            return address(0);
        }
    }

    function setDelegate(uint256 tokenId, address delegate) external {
        if (isSealed(tokenId)) revert AlreadySealed();
        address tokenOwner = art.ownerOf(tokenId);
        if (tokenOwner != msg.sender) revert NotAuthorized();
        _delegateGrant[tokenId] = DelegateGrant({
            delegate: delegate,
            grantor: tokenOwner,
            epoch: art.ownershipEpoch(tokenId)
        });
        emit DelegateSet(tokenId, tokenOwner, delegate);
    }

    function isSealed(uint256 tokenId) public view returns (bool) {
        return _overlayPointer[tokenId] != address(0);
    }

    function alteredPixels(uint256 tokenId) external view returns (uint16) {
        return _alteredPixels[tokenId];
    }

    function overlayHash(uint256 tokenId) external view returns (bytes32) {
        return _overlayHash[tokenId];
    }

    function overlayOf(uint256 tokenId) external view returns (bytes memory) {
        address pointer = _overlayPointer[tokenId];
        return pointer == address(0) ? BitmapLib.blank() : SSTORE2.read(pointer);
    }

    function isOutlawActive(uint256 tokenId) external view returns (bool) {
        return _outlawActive[tokenId];
    }

    /// @notice The immutable deployment artist may use the full 40x40 canvas, but must still
    /// own the NFT or hold a current owner-granted delegate permission.
    function maxAlteredPixelsFor(address operator) public view returns (uint256) {
        return operator == privilegedArtist ? MAX_PRIVILEGED_ARTIST_PIXELS : MAX_ALTERED_PIXELS;
    }

    /// @notice Selects which immutable identity is exposed by tokenURI and marketplaces.
    /// Only the current token owner can switch; the sealed overlay is never modified.
    function setActiveIdentity(uint256 tokenId, bool outlawActive) external {
        if (!art.startIndexSet()) revert RevealNotSet();
        address tokenOwner = art.ownerOf(tokenId);
        if (tokenOwner != msg.sender) revert NotAuthorized();
        if (outlawActive && !isSealed(tokenId)) revert OutlawNotSealed();
        if (_outlawActive[tokenId] == outlawActive) revert IdentityUnchanged();

        _outlawActive[tokenId] = outlawActive;
        art.notifyMetadataUpdate(tokenId);
        emit ActiveIdentitySet(tokenId, tokenOwner, outlawActive);
    }

    /// @notice Permanently seals a 200-byte XOR overlay. Regular editors may change up to 256
    /// pixels; the immutable privileged artist may change all 1,600 when otherwise authorized.
    function sealOutlaw(uint256 tokenId, bytes calldata xorOverlay) external whenNotPaused {
        if (!art.startIndexSet()) revert RevealNotSet();
        if (isSealed(tokenId)) revert AlreadySealed();
        if (xorOverlay.length != BitmapLib.BYTE_LEN) revert InvalidOverlayLength();

        address tokenOwner = art.ownerOf(tokenId);
        if (msg.sender != tokenOwner) {
            DelegateGrant memory grant = _delegateGrant[tokenId];
            if (
                grant.delegate != msg.sender || grant.grantor != tokenOwner
                    || grant.epoch != art.ownershipEpoch(tokenId)
            ) revert NotAuthorized();
        }

        bytes memory overlay = xorOverlay;
        uint256 count = BitmapLib.popcount(overlay);
        if (count == 0) revert EmptyOverlay();
        if (count > maxAlteredPixelsFor(msg.sender)) revert TooManyPixels();

        bytes32 hash = keccak256(overlay);
        _overlayPointer[tokenId] = SSTORE2.write(overlay);
        _alteredPixels[tokenId] = uint16(count);
        _overlayHash[tokenId] = hash;
        _outlawActive[tokenId] = true;

        art.notifyMetadataUpdate(tokenId);
        emit OutlawSealed(tokenId, tokenOwner, msg.sender, uint16(count), hash);
        emit ActiveIdentitySet(tokenId, tokenOwner, true);
    }
}
