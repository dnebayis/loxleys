// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RegisterAgent8004} from "../script/RegisterAgent8004.s.sol";
import {IAdapter8004} from "../src/interfaces/IAdapter8004.sol";

contract MockAdapter8004 is IAdapter8004 {
    uint8 public standard;
    address public tokenContract;
    uint256 public tokenId;
    string public uri;

    function register(uint8 standard_, address tokenContract_, uint256 tokenId_, string calldata uri_)
        external
        returns (uint256 agentId)
    {
        standard = standard_;
        tokenContract = tokenContract_;
        tokenId = tokenId_;
        uri = uri_;
        agentId = 8004;
        emit AgentBound(agentId, standard_, tokenContract_, tokenId_, msg.sender);
    }
}

contract MockArt {}

contract RegisterAgent8004Test is Test {
    RegisterAgent8004 internal script;
    MockAdapter8004 internal adapter;
    MockArt internal art;

    function setUp() public {
        script = new RegisterAgent8004();
        adapter = new MockAdapter8004();
        art = new MockArt();
    }

    function test_RegisterBuildsCanonicalCalldata() public {
        uint256 agentId = script.register(address(adapter), address(art), 42, "https://api.loxleys.xyz/");

        assertEq(agentId, 8004);
        assertEq(adapter.standard(), 0);
        assertEq(adapter.tokenContract(), address(art));
        assertEq(adapter.tokenId(), 42);
        assertEq(adapter.uri(), "https://api.loxleys.xyz/agents/metadata/42");
    }

    function test_RegisterFailsWithoutAdapter() public {
        vm.expectRevert(RegisterAgent8004.AdapterNotConfigured.selector);
        script.register(address(0), address(art), 1, "https://api.loxleys.xyz");
    }

    function test_AgentUriRequiresPublicBaseUrl() public {
        vm.expectRevert(RegisterAgent8004.PublicApiNotConfigured.selector);
        script.agentURI("", 1);
    }
}
