// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IAdapter8004} from "../src/interfaces/IAdapter8004.sol";

contract RegisterAgent8004 is Script {
    uint8 internal constant ERC721_STANDARD = 0;

    error AdapterNotConfigured();
    error ArtNotConfigured();
    error PublicApiNotConfigured();

    function agentURI(string memory publicApiBaseUrl, uint256 tokenId)
        public
        pure
        returns (string memory)
    {
        bytes memory base = bytes(publicApiBaseUrl);
        if (base.length == 0) revert PublicApiNotConfigured();
        while (base.length > 0 && base[base.length - 1] == "/") {
            assembly {
                mstore(base, sub(mload(base), 1))
            }
        }
        return string.concat(string(base), "/agents/metadata/", vm.toString(tokenId));
    }

    function register(address adapter, address art, uint256 tokenId, string memory publicApiBaseUrl)
        public
        returns (uint256 agentId)
    {
        if (adapter == address(0) || adapter.code.length == 0) revert AdapterNotConfigured();
        if (art == address(0) || art.code.length == 0) revert ArtNotConfigured();
        agentId = IAdapter8004(adapter).register(
            ERC721_STANDARD, art, tokenId, agentURI(publicApiBaseUrl, tokenId)
        );
    }

    function run() external returns (uint256 agentId) {
        address adapter = vm.envOr("ADAPTER8004_ADDRESS", address(0));
        address art = vm.envOr("LOXLEYS_ART_ADDRESS", address(0));
        uint256 tokenId = vm.envUint("TOKEN_ID");
        string memory publicApiBaseUrl = vm.envOr("PUBLIC_API_BASE_URL", string(""));

        if (adapter == address(0)) revert AdapterNotConfigured();
        if (art == address(0)) revert ArtNotConfigured();
        if (bytes(publicApiBaseUrl).length == 0) revert PublicApiNotConfigured();

        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        agentId = register(adapter, art, tokenId, publicApiBaseUrl);
        vm.stopBroadcast();

        console.log("Adapter8004 agentId:", agentId);
        console.log("agentURI:", agentURI(publicApiBaseUrl, tokenId));
    }
}
