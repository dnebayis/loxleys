// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LoxleysArt} from "../src/LoxleysArt.sol";
import {MainnetGuard} from "./MainnetGuard.sol";

/// @notice Configures the ten named Legendary 1/1 tokens on a deployed 2K collection.
contract ConfigureLegendary is MainnetGuard {
    function run() external {
        LoxleysArt art = LoxleysArt(vm.envAddress("ART_CONTRACT"));
        uint256 key = _checkedKey(art);
        require(!art.traitOverridesLocked(), "trait overrides already locked");

        vm.startBroadcast(key);
        art.setSpecialMetadata(
            1990,
            "Robin Hood",
            "The legendary outlaw archer who leads the Loxleys from Sherwood.",
            0x03000114010f0403
        );
        art.setSpecialMetadata(
            1991,
            "Maid Marian",
            "The noble forest heroine, strategist, and equal of Robin Hood.",
            0x040101080e0f0812
        );
        art.setSpecialMetadata(
            1992,
            "Little John",
            "Robin Hood's towering and steadfast second-in-command.",
            0x0300010204000800
        );
        art.setSpecialMetadata(
            1993,
            "Friar Tuck",
            "The jovial friar whose courage and counsel sustain the outlaws.",
            0x0400020004000100
        );
        art.setSpecialMetadata(
            1994,
            "Will Scarlet",
            "The elegant swordsman and daring member of the Merry Men.",
            0x0100010b030f020e
        );
        art.setSpecialMetadata(
            1995,
            "Alan-a-Dale",
            "The wandering minstrel who carries the stories of Sherwood.",
            0x0000010700000100
        );
        art.setSpecialMetadata(
            1996,
            "Much the Miller's Son",
            "The resourceful young outlaw and loyal scout of Sherwood.",
            0x00000003080a0602
        );
        art.setSpecialMetadata(
            1997,
            "Sheriff of Nottingham",
            "The relentless authority hunting Robin Hood and his allies.",
            0x05000215020b070f
        );
        art.setSpecialMetadata(
            1998,
            "Sir Guy of Gisborne",
            "The feared knight and calculating rival of Robin Hood.",
            0x0500010b0d0f0404
        );
        art.setSpecialMetadata(
            1999,
            "King Richard",
            "The Lionheart king whose return may restore justice to the realm.",
            0x03000108040f0409
        );
        vm.stopBroadcast();

        console.log("Configured named-rare art slots 1990..1999");
    }
}
