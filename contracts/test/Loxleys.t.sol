// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LoxleysArt} from "../src/LoxleysArt.sol";
import {LoxleysCanvas} from "../src/LoxleysCanvas.sol";
import {LoxleysRenderer} from "../src/LoxleysRenderer.sol";
import {BitmapLib} from "../src/lib/BitmapLib.sol";
import {Base64} from "solady/utils/Base64.sol";

contract LoxleysTest is Test {
    LoxleysArt art;
    LoxleysCanvas canvas;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        address[] memory drops = new address[](1);
        drops[0] = address(this);
        art = new LoxleysArt(address(this), drops);
        canvas = new LoxleysCanvas(address(art), address(this));
        art.setCanvas(address(canvas));
        LoxleysRenderer renderer = new LoxleysRenderer(address(art));
        art.setRenderer(address(renderer));
        for (uint256 i; i < art.NUM_BATCHES(); ++i) _uploadBatch(i);
        _configureNamedRares();
    }

    function _uploadBatch(uint256 batchIndex) internal {
        uint256 n = art.BATCH_SIZE();
        bytes memory bitmaps = new bytes(n * BitmapLib.BYTE_LEN);
        bytes memory traits = new bytes(n * 8);
        for (uint256 i; i < n; ++i) {
            bitmaps[i * BitmapLib.BYTE_LEN] = bytes1(uint8(i + 1));
            traits[i * 8] = bytes1(uint8(i % 10));
        }
        art.uploadArt(batchIndex, bitmaps, traits);
    }

    function _mint(address to, uint256 quantity) internal {
        art.mintSeaDrop(to, quantity);
    }

    function _configureNamedRares() internal {
        for (uint256 i; i < art.NAMED_RARE_COUNT(); ++i) {
            art.setSpecialMetadata(
                art.NAMED_RARE_START() + i,
                string.concat("Named Rare ", vm.toString(i + 1)),
                "Named rare",
                bytes8(uint64(i + 1))
            );
        }
    }

    function _reveal(uint256 offset) internal {
        uint256 supply = art.totalSupply();
        if (supply < art.NAMED_RARE_COUNT()) _mint(bob, art.NAMED_RARE_COUNT() - supply);
        art.closeMintingForReveal();
        art.lockTraitOverrides();
        art.reveal(offset);
    }

    function _overlay(uint256 count) internal pure returns (bytes memory out) {
        out = BitmapLib.blank();
        for (uint256 i; i < count; ++i) {
            BitmapLib.setPixel(out, i % BitmapLib.WIDTH, i / BitmapLib.WIDTH, true);
        }
    }

    function _checkerboardOverlay() internal pure returns (bytes memory out) {
        out = BitmapLib.blank();
        for (uint256 y; y < BitmapLib.HEIGHT; ++y) {
            for (uint256 x; x < BitmapLib.WIDTH; ++x) {
                if ((x + y) % 2 == 0) BitmapLib.setPixel(out, x, y, true);
            }
        }
    }

    function _decodedTokenURI(uint256 tokenId) internal view returns (string memory) {
        bytes memory uri = bytes(art.tokenURI(tokenId));
        bytes memory encoded = new bytes(uri.length - 29);
        for (uint256 i = 29; i < uri.length; ++i) encoded[i - 29] = uri[i];
        return string(Base64.decode(string(encoded)));
    }

    function _contains(string memory value, string memory needle) internal pure returns (bool) {
        bytes memory haystack = bytes(value);
        bytes memory search = bytes(needle);
        if (search.length > haystack.length) return false;
        for (uint256 i; i <= haystack.length - search.length; ++i) {
            bool found = true;
            for (uint256 j; j < search.length; ++j) {
                if (haystack[i + j] != search[j]) { found = false; break; }
            }
            if (found) return true;
        }
        return false;
    }

    function test_SeaDropOnlyMintAndSupply() public {
        vm.prank(alice);
        vm.expectRevert();
        art.mintSeaDrop(alice, 1);

        _mint(alice, 150);
        assertEq(art.totalSupply(), 150);
        assertEq(art.ownerOf(1), alice);
        assertEq(art.maxSupply(), 2_000);
        assertEq(art.PUBLIC_SUPPLY(), 2_000);
        assertEq(art.SPECIAL_RESERVE(), 0);
    }

    function test_PlaceholderBeforePostMintReveal() public {
        _mint(alice, 1);
        assertTrue(_contains(_decodedTokenURI(1), "Unrevealed"));
        vm.expectRevert(LoxleysArt.RevealNotSet.selector);
        art.slotOf(1);
        vm.prank(alice);
        vm.expectRevert(LoxleysCanvas.RevealNotSet.selector);
        canvas.sealOutlaw(1, _overlay(1));
    }

    function test_CloseIsIrreversibleAndBlocksMint() public {
        vm.expectRevert(LoxleysArt.NoMintedSupply.selector);
        art.closeMintingForReveal();
        _mint(alice, 1);
        vm.expectRevert(LoxleysArt.InsufficientMintedSupply.selector);
        art.closeMintingForReveal();
        _mint(alice, 9);
        art.closeMintingForReveal();
        vm.expectRevert(LoxleysArt.MintingClosed.selector);
        art.mintSeaDrop(bob, 1);
        vm.expectRevert(LoxleysArt.MintingClosed.selector);
        art.closeMintingForReveal();
    }

    function test_OwnerRevealCreatesFullSupplyOffset() public {
        _mint(alice, 2);
        _reveal(1_990);
        assertTrue(art.startIndexSet());
        assertEq(art.startIndex(), 1_990);
        assertEq(art.slotOf(1), 1_990);
        assertEq(art.slotOf(2), 1_991);
        assertFalse(_contains(_decodedTokenURI(1), "Unrevealed"));
    }

    function test_RevealRejectsEarlyInvalidAndRepeatedOffsets() public {
        _mint(alice, 1);
        vm.expectRevert(LoxleysArt.MintingStillOpen.selector);
        art.reveal(1);
        _mint(bob, 9);
        art.closeMintingForReveal();
        vm.expectRevert(LoxleysArt.MetadataNotLocked.selector);
        art.reveal(77);
        art.lockTraitOverrides();
        vm.expectRevert(LoxleysArt.InvalidArtSlot.selector);
        art.reveal(2_000);
        vm.expectRevert(LoxleysArt.NamedRareUnassigned.selector);
        art.reveal(77);
        art.reveal(1_990);
        assertEq(art.startIndex(), 1_990);
        vm.expectRevert(LoxleysArt.AlreadyRevealed.selector);
        art.reveal(1_991);
    }

    function test_RevealIsOwnerOnly() public {
        _mint(alice, 1);
        _mint(bob, 9);
        art.closeMintingForReveal();
        art.lockTraitOverrides();
        vm.prank(alice);
        vm.expectRevert();
        art.reveal(0);
        art.reveal(1_990);
        assertEq(art.startIndex(), 1_990);
    }

    function test_LockFreezesNamedMetadata() public {
        art.setSpecialMetadata(1_990, "Robin Hood", "Named rare", bytes8(0x03000114010f0403));
        art.lockTraitOverrides();
        vm.expectRevert(LoxleysArt.TraitOverridesLockedError.selector);
        art.setSpecialMetadata(1_990, "Changed", "Changed");
        vm.expectRevert(LoxleysArt.TraitOverridesLockedError.selector);
        art.setSpecialPersona(1_990, "Changed");
    }

    function test_SpecialMetadataIsRestrictedToTenNamedRareSlots() public {
        vm.expectRevert(LoxleysArt.InvalidNamedRareSlot.selector);
        art.setSpecialMetadata(1_989, "Eleventh Rare", "Must not exist", bytes8(uint64(11)));

        vm.expectRevert(LoxleysArt.InvalidNamedRareSlot.selector);
        art.setSpecialPersona(0, "Must not exist");

        vm.expectRevert(LoxleysArt.InvalidNamedRareSlot.selector);
        art.setSpecialTraits(2_000, bytes8(uint64(11)));
    }

    function test_NamedRareMetadataFollowsArtSlot() public {
        art.setSpecialMetadata(1_990, "Robin Hood", "Named rare", bytes8(0x03000114010f0403));
        _mint(alice, 1);
        _reveal(1_990);
        assertTrue(art.isSpecial(1));
        assertEq(art.specialNameOf(1), "Robin Hood");
        assertTrue(_contains(_decodedTokenURI(1), "Robin Hood"));
        assertTrue(_contains(_decodedTokenURI(1), "Named Rare"));
    }

    function test_CanvasAccepts256AndRejects257Pixels() public {
        _mint(alice, 2);
        _reveal(1_990);
        vm.prank(alice);
        canvas.sealOutlaw(1, _overlay(256));
        assertEq(canvas.alteredPixels(1), 256);

        vm.prank(alice);
        vm.expectRevert(LoxleysCanvas.TooManyPixels.selector);
        canvas.sealOutlaw(2, _overlay(257));
    }

    function test_PrivilegedArtistCanUse1600ButCannotBypassTokenAuthorization() public {
        _mint(alice, 1);
        _reveal(1_990);

        vm.expectRevert(LoxleysCanvas.NotAuthorized.selector);
        canvas.sealOutlaw(1, _overlay(1_600));

        vm.prank(alice);
        canvas.setDelegate(1, address(this));
        canvas.sealOutlaw(1, _overlay(1_600));
        assertEq(canvas.alteredPixels(1), 1_600);
    }

    function test_FragmentedPrivilegedCanvasTokenURIStaysCallable() public {
        _mint(alice, 1);
        _reveal(1_990);
        vm.prank(alice);
        canvas.setDelegate(1, address(this));
        canvas.sealOutlaw(1, _checkerboardOverlay());

        uint256 gasBefore = gasleft();
        string memory uri = art.tokenURI(1);
        uint256 gasUsed = gasBefore - gasleft();
        emit log_named_uint("fragmented tokenURI gas", gasUsed);
        assertGt(bytes(uri).length, 0);
        assertLt(gasUsed, 20_000_000);
    }

    function test_CanvasIsWriteOnceAndIdentityCanToggle() public {
        _mint(alice, 1);
        _reveal(1_990);
        vm.prank(alice);
        canvas.sealOutlaw(1, _overlay(12));
        vm.prank(alice);
        vm.expectRevert(LoxleysCanvas.AlreadySealed.selector);
        canvas.sealOutlaw(1, _overlay(1));
        vm.prank(alice);
        canvas.setActiveIdentity(1, false);
        assertFalse(canvas.isOutlawActive(1));
    }

    function test_TransferChangesCanvasAuthority() public {
        _mint(alice, 1);
        _reveal(1_990);
        vm.prank(alice);
        art.transferFrom(alice, bob, 1);
        vm.prank(alice);
        vm.expectRevert(LoxleysCanvas.NotAuthorized.selector);
        canvas.sealOutlaw(1, _overlay(1));
        vm.prank(bob);
        canvas.sealOutlaw(1, _overlay(1));
    }

    function test_DelegateDoesNotReviveAfterOwnershipRoundTrip() public {
        _mint(alice, 1);
        _reveal(1_990);
        vm.prank(alice);
        canvas.setDelegate(1, address(this));
        vm.prank(alice);
        art.transferFrom(alice, bob, 1);
        vm.prank(bob);
        art.transferFrom(bob, alice, 1);

        assertEq(canvas.delegateOf(1), address(0));
        vm.expectRevert(LoxleysCanvas.NotAuthorized.selector);
        canvas.sealOutlaw(1, _overlay(1));
        vm.prank(alice);
        canvas.sealOutlaw(1, _overlay(1));
    }

    function test_RoyaltyAndInterfaces() public view {
        (address receiver, uint256 amount) = art.royaltyInfo(1, 1 ether);
        assertEq(receiver, address(this));
        assertEq(amount, 0.025 ether);
        assertTrue(art.supportsInterface(0x49064906));
        assertTrue(art.supportsInterface(0x2a55205a));
    }
}
