// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdStorage, stdStorage} from "forge-std/StdStorage.sol";
import {LoxleysArt} from "../src/LoxleysArt.sol";
import {AgentExtensions} from "../src/AgentExtensions.sol";
import {LoxleysRenderer} from "../src/LoxleysRenderer.sol";
import {BitmapLib} from "../src/lib/BitmapLib.sol";

contract AgentExtensionsTest is Test {
    using stdStorage for StdStorage;
    LoxleysArt art;
    AgentExtensions ext;

    address owner = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address carol = address(0xCA401);

    uint256 aliceAgent;
    uint256 bobAgent;

    function setUp() public {
        address[] memory drops = new address[](1);
        drops[0] = address(this);
        art = new LoxleysArt(owner, drops);
        LoxleysRenderer renderer = new LoxleysRenderer(address(art));
        art.setRenderer(address(renderer));
        for (uint256 i; i < art.NUM_BATCHES(); ++i) _uploadBatch(i);
        for (uint256 i; i < art.NAMED_RARE_COUNT(); ++i) {
            art.setSpecialMetadata(
                art.NAMED_RARE_START() + i,
                string.concat("Named Rare ", vm.toString(i + 1)),
                "Named rare",
                bytes8(uint64(i + 1))
            );
        }
        ext = new AgentExtensions(address(art), owner);
        art.setExtensions(address(ext));

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        // Keep the two agents on ordinary art slots while still minting enough tokens
        // for every Named Rare slot to remain assigned at reveal.
        art.mintSeaDrop(address(0xF111), 11);
        aliceAgent = _mintAs(alice); // #12 -> slot 0
        bobAgent = _mintAs(bob);     // #13 -> slot 1
        art.closeMintingForReveal();
        art.lockTraitOverrides();
        art.reveal(1_989);
    }

    function _uploadBatch(uint256 batchIndex) internal {
        uint256 n = art.BATCH_SIZE();
        bytes memory bitmaps = new bytes(n * BitmapLib.BYTE_LEN);
        bytes memory traits = new bytes(n * 8);
        for (uint256 i = 0; i < n; ++i) {
            bitmaps[i * BitmapLib.BYTE_LEN] = 0xFF;
            traits[i * 8] = bytes1(uint8(i % 10));
        }
        art.uploadArt(batchIndex, bitmaps, traits);
    }

    function _mintAs(address who) internal returns (uint256 id) {
        id = art.totalSupply() + 1;
        art.mintSeaDrop(who, 1);
    }

    // ------------------------------------------------ A. memory

    function test_RememberAppendsOwnerOnly() public {
        vm.prank(bob);
        vm.expectRevert(AgentExtensions.NotAgentOwner.selector);
        ext.remember(aliceAgent, "born at block zero");

        vm.prank(alice);
        ext.remember(aliceAgent, "born at block zero");
        vm.prank(alice);
        ext.remember(aliceAgent, "learned to trade");

        assertEq(ext.memoryCount(aliceAgent), 2);
        assertEq(ext.memoriesOf(aliceAgent)[1], "learned to trade");
    }

    function test_RememberRejectsBadLengthAndFull() public {
        vm.prank(alice);
        vm.expectRevert(AgentExtensions.BadEntryLength.selector);
        ext.remember(aliceAgent, "");

        vm.prank(alice);
        vm.expectRevert(AgentExtensions.BadEntryLength.selector);
        ext.remember(aliceAgent, string(new bytes(97)));

        for (uint256 i = 0; i < ext.MAX_MEMORIES(); ++i) {
            vm.prank(alice);
            ext.remember(aliceAgent, "m");
        }
        vm.prank(alice);
        vm.expectRevert(AgentExtensions.MemoryFull.selector);
        ext.remember(aliceAgent, "one too many");
    }

    function test_RememberRejectsUnsafeMetadataCharacters() public {
        vm.prank(alice);
        vm.expectRevert(AgentExtensions.BadEntryCharacter.selector);
        ext.remember(aliceAgent, string(hex"0a"));

        vm.prank(alice);
        vm.expectRevert(AgentExtensions.BadEntryCharacter.selector);
        ext.remember(aliceAgent, unicode"ş");
    }

    function test_FullPersonaIncludesMemories() public {
        string memory bare = ext.fullPersona(aliceAgent);
        assertTrue(bytes(bare).length > 0);

        vm.prank(alice);
        ext.remember(aliceAgent, "awakened");
        string memory withMem = ext.fullPersona(aliceAgent);
        assertGt(bytes(withMem).length, bytes(bare).length);
    }

    // ------------------------------------------------ B. capabilities

    function test_CapabilitiesAreDerivedFromTraits() public {
        assertEq(ext.capabilityCount(aliceAgent), 3);

        (string memory typeCap, string memory typeUri) = ext.capabilityOf(aliceAgent, 0);
        assertEq(typeCap, "Human Scout Protocol");
        assertEq(typeUri, "loxleys://capability/type/0");

        (string memory eyeCap, string memory eyeUri) = ext.capabilityOf(aliceAgent, 1);
        assertEq(eyeCap, "Normal Perception");
        assertEq(eyeUri, "loxleys://capability/eyes/0");

        AgentExtensions.DerivedCapability[] memory caps = ext.capabilitiesOf(aliceAgent);
        assertEq(caps.length, 3);
        assertEq(caps[2].name, "None Presence");
        assertEq(caps[2].manifestURI, "loxleys://capability/accessory/0");

        vm.expectRevert(AgentExtensions.BadCapabilityIndex.selector);
        ext.capabilityOf(aliceAgent, 3);
    }

    // ------------------------------------------------ C. social

    function test_AllianceRequestAccept() public {
        vm.prank(alice);
        ext.requestAlliance(aliceAgent, bobAgent);
        assertTrue(ext.hasPendingRequest(aliceAgent, bobAgent));
        assertFalse(ext.areAllied(aliceAgent, bobAgent));

        // only bob (owner of toAgent) can accept
        vm.prank(alice);
        vm.expectRevert(AgentExtensions.NotAgentOwner.selector);
        ext.acceptAlliance(bobAgent, aliceAgent);

        vm.prank(bob);
        ext.acceptAlliance(bobAgent, aliceAgent);
        assertTrue(ext.areAllied(aliceAgent, bobAgent));
        assertTrue(ext.areAllied(bobAgent, aliceAgent));
        assertEq(ext.alliesOf(aliceAgent).length, 1);
        assertEq(ext.alliesOf(bobAgent)[0], aliceAgent);
    }

    function test_AllianceAutoFormsOnMutualRequest() public {
        vm.prank(bob);
        ext.requestAlliance(bobAgent, aliceAgent);

        // alice requesting back completes it immediately (both consented)
        vm.prank(alice);
        ext.requestAlliance(aliceAgent, bobAgent);
        assertTrue(ext.areAllied(aliceAgent, bobAgent));
        assertFalse(ext.hasPendingRequest(bobAgent, aliceAgent));
    }

    function test_AllianceRequestExpiresWhenRequesterTransfers() public {
        vm.prank(alice);
        ext.requestAlliance(aliceAgent, bobAgent);

        vm.prank(alice);
        art.transferFrom(alice, carol, aliceAgent);
        assertFalse(ext.hasPendingRequest(aliceAgent, bobAgent));

        vm.prank(bob);
        vm.expectRevert(AgentExtensions.NoRequest.selector);
        ext.acceptAlliance(bobAgent, aliceAgent);

        vm.prank(carol);
        ext.requestAlliance(aliceAgent, bobAgent);
        vm.prank(bob);
        ext.acceptAlliance(bobAgent, aliceAgent);
        assertTrue(ext.areAllied(aliceAgent, bobAgent));
    }

    function test_AllianceRequestDoesNotReviveAfterRequesterRoundTrip() public {
        vm.prank(alice);
        ext.requestAlliance(aliceAgent, bobAgent);
        vm.prank(alice);
        art.transferFrom(alice, carol, aliceAgent);
        vm.prank(carol);
        art.transferFrom(carol, alice, aliceAgent);

        assertFalse(ext.hasPendingRequest(aliceAgent, bobAgent));
        vm.prank(bob);
        vm.expectRevert(AgentExtensions.NoRequest.selector);
        ext.acceptAlliance(bobAgent, aliceAgent);
    }

    function test_AllianceRequestExpiresWhenRecipientTransfers() public {
        vm.prank(alice);
        ext.requestAlliance(aliceAgent, bobAgent);
        vm.prank(bob);
        art.transferFrom(bob, carol, bobAgent);

        assertFalse(ext.hasPendingRequest(aliceAgent, bobAgent));
        vm.prank(carol);
        vm.expectRevert(AgentExtensions.NoRequest.selector);
        ext.acceptAlliance(bobAgent, aliceAgent);
    }

    function test_BreakAllianceEitherSide() public {
        vm.prank(alice);
        ext.requestAlliance(aliceAgent, bobAgent);
        vm.prank(bob);
        ext.acceptAlliance(bobAgent, aliceAgent);

        vm.prank(bob);
        ext.breakAlliance(bobAgent, aliceAgent);
        assertFalse(ext.areAllied(aliceAgent, bobAgent));
        assertEq(ext.alliesOf(aliceAgent).length, 0);
        assertEq(ext.alliesOf(bobAgent).length, 0);
    }

    // ------------------------------------------------ tokenURI wiring

    function test_TokenURIReflectsExtensions() public {
        uint256 base = bytes(art.tokenURI(aliceAgent)).length;

        vm.prank(alice);
        ext.remember(aliceAgent, "awakened on-chain");
        uint256 withMem = bytes(art.tokenURI(aliceAgent)).length;
        assertGt(withMem, base); // memory extended the description

        string memory fragment = ext.attributesFragment(aliceAgent);
        assertTrue(_contains(fragment, '"Capability","value":"Human Scout Protocol"'));
        assertTrue(_contains(fragment, '"Capability","value":"Normal Perception"'));
        assertTrue(_contains(fragment, '"Capability","value":"None Presence"'));
    }

    function test_SetExtensionsOnceOnly() public {
        vm.expectRevert(LoxleysArt.ExtensionsAlreadySet.selector);
        art.setExtensions(address(ext));
    }

    function test_SocialGuards() public {
        vm.prank(alice);
        vm.expectRevert(AgentExtensions.SelfAlliance.selector);
        ext.requestAlliance(aliceAgent, aliceAgent);

        vm.prank(bob);
        vm.expectRevert(AgentExtensions.NotAgentOwner.selector);
        ext.requestAlliance(aliceAgent, bobAgent);

        vm.prank(alice);
        ext.requestAlliance(aliceAgent, bobAgent);
        vm.prank(alice);
        vm.expectRevert(AgentExtensions.AlreadyRequested.selector);
        ext.requestAlliance(aliceAgent, bobAgent);
    }

    function _contains(string memory value, string memory needle) internal pure returns (bool) {
        bytes memory haystack = bytes(value);
        bytes memory search = bytes(needle);
        if (search.length > haystack.length) return false;
        for (uint256 i = 0; i <= haystack.length - search.length; ++i) {
            bool found = true;
            for (uint256 j = 0; j < search.length; ++j) {
                if (haystack[i + j] != search[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }
}
