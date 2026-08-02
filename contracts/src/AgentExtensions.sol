// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "solady/auth/Ownable.sol";
import {LoxleysTraits} from "./lib/LoxleysTraits.sol";

interface ILoxleysAgent {
    function ownerOf(uint256 tokenId) external view returns (address);
    function ownershipEpoch(uint256 tokenId) external view returns (uint64);
    function traitsOf(uint256 tokenId) external view returns (bytes8);
    function notifyMetadataUpdate(uint256 tokenId) external;
}

/// @notice The "living agent" layer for Loxleys (D33): memories and alliances let
/// a Loxley grow beyond its minted traits, while capabilities remain derived from
/// the NFT traits exposed by LoxleysArt.
///
///   A. Memory (persona expansion, D16) — an append-only, immutable log the owner grows
///      over time. `fullPersona` = trait-derived base (D16) + accumulated memories.
///   B. Capabilities — read-only, non-assignable skills derived from Type, Eyes,
///      and Accessory traits.
///   C. Social — consent-based mutual alliances forming an on-chain agent social graph.
///
/// This contract deliberately has no identity-registry dependency. Ownership is resolved from
/// LoxleysArt on every protected write, allowing a separately deployed adapter to bind the NFT
/// to a future official agent registry without upgrading or redeploying this contract.
contract AgentExtensions is Ownable {
    ILoxleysAgent public immutable art;

    // ---- Module A: memory ----
    uint256 public constant MAX_MEMORIES = 32;
    uint256 public constant MAX_ENTRY_LEN = 96;
    mapping(uint256 => string[]) internal _memories;

    // ---- Module B: trait-derived capabilities ----
    struct DerivedCapability {
        string name;
        string manifestURI;
    }

    // ---- Module C: social ----
    uint256 public constant MAX_ALLIES = 64;
    mapping(uint256 => mapping(uint256 => bool)) internal _requested; // from => to => pending
    mapping(uint256 => mapping(uint256 => address)) internal _requester; // owner snapshot
    mapping(uint256 => mapping(uint256 => uint64)) internal _requesterEpoch;
    mapping(uint256 => mapping(uint256 => uint64)) internal _recipientEpoch;
    mapping(uint256 => uint256[]) internal _allyList; // agentId => allied agentIds
    mapping(uint256 => mapping(uint256 => uint256)) internal _allyIdx; // a => b => index+1

    event Remembered(uint256 indexed agentId, uint256 index, string entry);
    event AllianceRequested(uint256 indexed fromAgent, uint256 indexed toAgent);
    event AllianceFormed(uint256 indexed agentA, uint256 indexed agentB);
    event AllianceBroken(uint256 indexed agentA, uint256 indexed agentB);

    error NotAgentOwner();
    error MemoryFull();
    error BadEntryLength();
    error BadEntryCharacter();
    error BadCapabilityIndex();
    error SelfAlliance();
    error AlreadyAllied();
    error NotAllied();
    error AlreadyRequested();
    error NoRequest();
    error AllyLimit();

    constructor(address artAddress, address initialOwner) {
        art = ILoxleysAgent(artAddress);
        _initializeOwner(initialOwner);
    }

    /// @dev Reverts unless caller owns `agentId` (also reverts if the token doesn't exist).
    modifier onlyAgentOwner(uint256 agentId) {
        if (art.ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        _;
    }

    // ---------------------------------------------------------------- A. memory

    /// @notice Appends an immutable memory entry to `agentId`'s log (owner only).
    function remember(uint256 agentId, string calldata entry) external onlyAgentOwner(agentId) {
        uint256 len = bytes(entry).length;
        if (len == 0 || len > MAX_ENTRY_LEN) revert BadEntryLength();
        for (uint256 i = 0; i < len; ++i) {
            bytes1 char = bytes(entry)[i];
            if (char < 0x20 || char > 0x7e) revert BadEntryCharacter();
        }
        string[] storage log = _memories[agentId];
        if (log.length >= MAX_MEMORIES) revert MemoryFull();
        log.push(entry);
        art.notifyMetadataUpdate(agentId);
        emit Remembered(agentId, log.length - 1, entry);
    }

    function memoriesOf(uint256 agentId) external view returns (string[] memory) {
        return _memories[agentId];
    }

    function memoryCount(uint256 agentId) external view returns (uint256) {
        return _memories[agentId].length;
    }

    /// @notice The agent's full persona: trait-derived base (D16) plus its memory log.
    function fullPersona(uint256 agentId) external view returns (string memory) {
        string memory base = LoxleysTraits.personaText(agentId, art.traitsOf(agentId));
        string[] storage log = _memories[agentId];
        if (log.length == 0) return base;
        bytes memory out = abi.encodePacked(base, " Memories:");
        for (uint256 i = 0; i < log.length; ++i) {
            out = abi.encodePacked(out, " ", log[i], ";");
        }
        return string(out);
    }

    // ---------------------------------------------------------------- B. capabilities

    function capabilityCount(uint256 agentId) external view returns (uint256) {
        art.ownerOf(agentId); // existence check
        return 3;
    }

    function capabilityOf(uint256 agentId, uint256 index)
        public
        view
        returns (string memory name, string memory manifestURI)
    {
        if (index >= 3) revert BadCapabilityIndex();
        bytes8 traits = art.traitsOf(agentId);
        if (index == 0) {
            uint8 typeValue = uint8(traits[0]);
            return (
                string(abi.encodePacked(LoxleysTraits.typeName(typeValue), " Protocol")),
                string(abi.encodePacked("loxleys://capability/type/", _toString(typeValue)))
            );
        }
        if (index == 1) {
            uint8 eyesValue = uint8(traits[5]);
            return (
                string(abi.encodePacked(LoxleysTraits.eyes(eyesValue), " Perception")),
                string(abi.encodePacked("loxleys://capability/eyes/", _toString(eyesValue)))
            );
        }
        uint8 accessoryValue = uint8(traits[7]);
        return (
            string(abi.encodePacked(LoxleysTraits.accessory(accessoryValue), " Presence")),
            string(abi.encodePacked("loxleys://capability/accessory/", _toString(accessoryValue)))
        );
    }

    function capabilitiesOf(uint256 agentId) external view returns (DerivedCapability[] memory out) {
        art.ownerOf(agentId); // existence check
        out = new DerivedCapability[](3);
        for (uint256 i = 0; i < 3; ++i) {
            (string memory name, string memory manifestURI) = capabilityOf(agentId, i);
            out[i] = DerivedCapability(name, manifestURI);
        }
    }

    // ---------------------------------------------------------------- tokenURI helpers

    /// @notice " Memories: e1; e2;" suffix for the agent's description, or "" if none.
    /// Composed by LoxleysArt.tokenURI after the base/persona text.
    function memoriesSuffix(uint256 agentId) external view returns (string memory) {
        string[] storage log = _memories[agentId];
        if (log.length == 0) return "";
        bytes memory out = abi.encodePacked(" Memories:");
        for (uint256 i = 0; i < log.length; ++i) {
            out = abi.encodePacked(out, " ", log[i], ";");
        }
        return string(out);
    }

    /// @notice OpenSea attribute entries for trait-derived capabilities + alliance/memory counts.
    /// Each entry is comma-prefixed so LoxleysArt can splice it before the closing "]".
    function attributesFragment(uint256 agentId) external view returns (string memory) {
        uint256 allyCount = _allyList[agentId].length;
        uint256 memCount = _memories[agentId].length;

        bytes memory out;
        for (uint256 i = 0; i < 3; ++i) {
            (string memory name,) = capabilityOf(agentId, i);
            out = abi.encodePacked(
                out, ',{"trait_type":"Capability","value":"', name, '"}'
            );
        }
        if (allyCount != 0) {
            out = abi.encodePacked(out, ',{"trait_type":"Alliances","value":', _toString(allyCount), "}");
        }
        if (memCount != 0) {
            out = abi.encodePacked(out, ',{"trait_type":"Memories","value":', _toString(memCount), "}");
        }
        return string(out);
    }

    // ---------------------------------------------------------------- C. social

    /// @notice Requests an alliance from `fromAgent` to `toAgent` (caller owns `fromAgent`).
    /// If `toAgent` had already requested `fromAgent`, the alliance forms immediately.
    function requestAlliance(uint256 fromAgent, uint256 toAgent) external onlyAgentOwner(fromAgent) {
        if (fromAgent == toAgent) revert SelfAlliance();
        art.ownerOf(toAgent); // existence check
        if (_allyIdx[fromAgent][toAgent] != 0) revert AlreadyAllied();

        if (_isCurrentRequest(toAgent, fromAgent)) {
            _requested[toAgent][fromAgent] = false;
            delete _requester[toAgent][fromAgent];
            delete _requesterEpoch[toAgent][fromAgent];
            delete _recipientEpoch[toAgent][fromAgent];
            _form(fromAgent, toAgent);
        } else {
            if (_isCurrentRequest(fromAgent, toAgent)) revert AlreadyRequested();
            _requested[toAgent][fromAgent] = false;
            delete _requester[toAgent][fromAgent];
            delete _requesterEpoch[toAgent][fromAgent];
            delete _recipientEpoch[toAgent][fromAgent];
            _requested[fromAgent][toAgent] = true;
            _requester[fromAgent][toAgent] = msg.sender;
            _requesterEpoch[fromAgent][toAgent] = art.ownershipEpoch(fromAgent);
            _recipientEpoch[fromAgent][toAgent] = art.ownershipEpoch(toAgent);
            emit AllianceRequested(fromAgent, toAgent);
        }
    }

    /// @notice Accepts a pending alliance request from `fromAgent` (caller owns `toAgent`).
    function acceptAlliance(uint256 toAgent, uint256 fromAgent) external onlyAgentOwner(toAgent) {
        if (!_isCurrentRequest(fromAgent, toAgent)) revert NoRequest();
        _requested[fromAgent][toAgent] = false;
        delete _requester[fromAgent][toAgent];
        delete _requesterEpoch[fromAgent][toAgent];
        delete _recipientEpoch[fromAgent][toAgent];
        _form(fromAgent, toAgent);
    }

    /// @notice Breaks an existing alliance (either side may call).
    function breakAlliance(uint256 agentId, uint256 other) external onlyAgentOwner(agentId) {
        uint256 idx1 = _allyIdx[agentId][other];
        if (idx1 == 0) revert NotAllied();
        _swapPop(_allyList[agentId], _allyIdx[agentId], idx1 - 1);
        _swapPop(_allyList[other], _allyIdx[other], _allyIdx[other][agentId] - 1);
        art.notifyMetadataUpdate(agentId);
        art.notifyMetadataUpdate(other);
        emit AllianceBroken(agentId, other);
    }

    function areAllied(uint256 a, uint256 b) external view returns (bool) {
        return _allyIdx[a][b] != 0;
    }

    function alliesOf(uint256 agentId) external view returns (uint256[] memory) {
        return _allyList[agentId];
    }

    function hasPendingRequest(uint256 fromAgent, uint256 toAgent) external view returns (bool) {
        return _isCurrentRequest(fromAgent, toAgent);
    }

    function _isCurrentRequest(uint256 fromAgent, uint256 toAgent) internal view returns (bool) {
        return _requested[fromAgent][toAgent]
            && _requester[fromAgent][toAgent] == art.ownerOf(fromAgent)
            && _requesterEpoch[fromAgent][toAgent] == art.ownershipEpoch(fromAgent)
            && _recipientEpoch[fromAgent][toAgent] == art.ownershipEpoch(toAgent);
    }

    function _form(uint256 a, uint256 b) internal {
        if (_allyList[a].length >= MAX_ALLIES || _allyList[b].length >= MAX_ALLIES) revert AllyLimit();
        _allyList[a].push(b);
        _allyIdx[a][b] = _allyList[a].length;
        _allyList[b].push(a);
        _allyIdx[b][a] = _allyList[b].length;
        art.notifyMetadataUpdate(a);
        art.notifyMetadataUpdate(b);
        emit AllianceFormed(a, b);
    }

    /// @dev Removes the element at `i` from `list` (swap-and-pop) and clears its index entry.
    function _swapPop(uint256[] storage list, mapping(uint256 => uint256) storage idx, uint256 i)
        internal
    {
        uint256 lastPos = list.length - 1;
        uint256 removed = list[i];
        if (i != lastPos) {
            uint256 moved = list[lastPos];
            list[i] = moved;
            idx[moved] = i + 1;
        }
        list.pop();
        idx[removed] = 0;
    }

    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { ++digits; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) { --digits; buffer[digits] = bytes1(uint8(48 + (value % 10))); value /= 10; }
        return string(buffer);
    }
}
