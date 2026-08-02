// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LoxleysArt} from "../src/LoxleysArt.sol";
import {LoxleysCanvas} from "../src/LoxleysCanvas.sol";
import {LoxleysRenderer} from "../src/LoxleysRenderer.sol";
import {AgentExtensions} from "../src/AgentExtensions.sol";

contract Deploy is Script {
    uint256 internal constant ROBINHOOD_MAINNET_CHAIN_ID = 4663;
    address internal constant ROBINHOOD_SEADROP = 0x00005EA00Ac477B1030CE78506496e8C2dE24bf5;

    function run() external {
        require(block.chainid == ROBINHOOD_MAINNET_CHAIN_ID, "Robinhood mainnet only");

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        address seaDrop = vm.envAddress("SEADROP_ADDRESS");

        require(deployer != address(0), "missing deployer");
        require(vm.addr(deployerPrivateKey) == deployer, "deployer key/address mismatch");
        require(seaDrop == ROBINHOOD_SEADROP, "unexpected SeaDrop address");
        require(seaDrop.code.length != 0, "SeaDrop has no bytecode");
        address[] memory allowedSeaDrop = new address[](1);
        allowedSeaDrop[0] = seaDrop;

        vm.startBroadcast(deployerPrivateKey);

        LoxleysArt art = new LoxleysArt(deployer, allowedSeaDrop);
        console.log("LoxleysArt:", address(art));

        LoxleysCanvas canvas = new LoxleysCanvas(address(art), deployer);
        console.log("LoxleysCanvas:", address(canvas));

        art.setCanvas(address(canvas));
        console.log("Canvas wired to Art");

        LoxleysRenderer renderer = new LoxleysRenderer(address(art));
        art.setRenderer(address(renderer));
        console.log("LoxleysRenderer:", address(renderer));

        AgentExtensions extensions = new AgentExtensions(address(art), deployer);
        console.log("AgentExtensions:", address(extensions));

        art.setExtensions(address(extensions));
        console.log("Extensions wired to Art");

        // Identity registration is intentionally external to the core deployment. Once the
        // official registry is finalized, a separately deployed adapter can resolve ownership
        // through LoxleysArt without changing Art, Canvas, Renderer, or AgentExtensions.

        string memory publicApiBaseUrl = vm.envOr("PUBLIC_API_BASE_URL", string(""));
        if (bytes(publicApiBaseUrl).length != 0) {
            art.setAnimationBaseURI(publicApiBaseUrl);
            console.log("Animation base URI:", publicApiBaseUrl);
        } else {
            console.log("Animation base URI pending PUBLIC_API_BASE_URL");
        }

        vm.stopBroadcast();
    }
}
