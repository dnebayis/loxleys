// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LoxleysArt} from "../src/LoxleysArt.sol";
import {MainnetGuard} from "./MainnetGuard.sol";

/// @notice Permanently disables further trait overrides on a deployed collection.
/// @dev This is irreversible. Set CONFIRM_LOCK_TRAIT_OVERRIDES=true intentionally.
contract LockTraitOverrides is MainnetGuard {
    function run() external {
        LoxleysArt art = LoxleysArt(vm.envAddress("ART_CONTRACT"));
        uint256 key = _checkedKey(art);
        bool confirmed = vm.envBool("CONFIRM_LOCK_TRAIT_OVERRIDES");
        require(confirmed, "set CONFIRM_LOCK_TRAIT_OVERRIDES=true");
        require(!art.traitOverridesLocked(), "trait overrides already locked");

        vm.startBroadcast(key);
        art.lockTraitOverrides();
        vm.stopBroadcast();

        console.log("Trait overrides locked for Art:", address(art));
    }
}
