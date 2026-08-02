// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LoxleysArt} from "../src/LoxleysArt.sol";
import {LoxleysCanvas} from "../src/LoxleysCanvas.sol";
import {LoxleysRenderer} from "../src/LoxleysRenderer.sol";
import {AgentExtensions} from "../src/AgentExtensions.sol";

contract MainnetForkTest is Test {
    address internal constant SEADROP = 0x00005EA00Ac477B1030CE78506496e8C2dE24bf5;

    function test_MainnetDependencyAndProductionWiring() public {
        string memory rpc = vm.envOr("ROBINHOOD_MAINNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;

        vm.createSelectFork(rpc);
        assertEq(block.chainid, 4663);
        assertGt(SEADROP.code.length, 0);

        address[] memory allowedSeaDrop = new address[](1);
        allowedSeaDrop[0] = SEADROP;
        LoxleysArt art = new LoxleysArt(address(this), allowedSeaDrop);
        LoxleysCanvas canvas = new LoxleysCanvas(address(art), address(this));
        LoxleysRenderer renderer = new LoxleysRenderer(address(art));
        AgentExtensions extensions = new AgentExtensions(address(art), address(this));
        art.setCanvas(address(canvas));
        art.setRenderer(address(renderer));
        art.setExtensions(address(extensions));

        assertEq(art.owner(), address(this));
        assertEq(canvas.owner(), address(this));
        assertEq(extensions.owner(), address(this));
        assertEq(canvas.privilegedArtist(), address(this));
        assertEq(address(art.canvas()), address(canvas));
        assertEq(address(art.renderer()), address(renderer));
        assertEq(address(art.extensions()), address(extensions));
        assertEq(art.maxSupply(), 2_000);
    }
}
