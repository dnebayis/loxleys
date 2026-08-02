// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice External ERC-8004 adapter surface used by Loxleys.
interface IAdapter8004 {
    event AgentBound(
        uint256 indexed agentId,
        uint8 indexed standard,
        address indexed tokenContract,
        uint256 tokenId,
        address registeredBy
    );

    function register(uint8 standard, address tokenContract, uint256 tokenId, string calldata agentURI)
        external
        returns (uint256 agentId);
}
