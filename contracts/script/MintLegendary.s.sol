// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
/// @notice Legacy guard: named rare items are part of the normal SeaDrop pool.
contract MintLegendary is Script {
    function run() external pure {
        console.log("Disabled: configure named-rare art slots, then mint every item through SeaDrop.");
    }
}
