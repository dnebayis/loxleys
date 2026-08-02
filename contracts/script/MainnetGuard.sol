// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {LoxleysArt} from "../src/LoxleysArt.sol";

/// @dev Shared production guard for irreversible post-deployment scripts.
abstract contract MainnetGuard is Script {
    uint256 internal constant ROBINHOOD_MAINNET_CHAIN_ID = 4663;

    function _checkedKey(LoxleysArt art) internal view returns (uint256 key) {
        require(block.chainid == ROBINHOOD_MAINNET_CHAIN_ID, "Robinhood mainnet only");
        require(address(art).code.length != 0, "Art has no bytecode");

        key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        require(deployer != address(0), "missing deployer");
        require(vm.addr(key) == deployer, "deployer key/address mismatch");
        require(art.owner() == deployer, "deployer is not Art owner");
        require(art.MAX_SUPPLY() == 2_000, "unexpected Art contract");
    }
}
