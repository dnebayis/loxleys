// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LoxleysArt} from "../src/LoxleysArt.sol";
import {MainnetGuard} from "./MainnetGuard.sol";

/// @notice Uploads one batch of pre-generated art to a deployed LoxleysArt.
/// Reads `{ART_DIR}/{tokenId}.bin` (200 bytes) and `{tokenId}.traits` (0x + 16 hex)
/// for the 100 tokens of batch `BATCH_INDEX`, packs them, and calls `uploadArt`.
///
/// Env: ART_CONTRACT, ART_DIR, BATCH_INDEX, DEPLOYER_PRIVATE_KEY.
/// Example: `BATCH_INDEX=0 forge script script/UploadArt.s.sol --rpc-url $RPC_URL --broadcast`
contract UploadArt is MainnetGuard {
    function run() external {
        LoxleysArt art = LoxleysArt(vm.envAddress("ART_CONTRACT"));
        uint256 key = _checkedKey(art);
        string memory dir = vm.envString("ART_DIR");
        uint256 batchIndex = vm.envUint("BATCH_INDEX");
        require(batchIndex < art.NUM_BATCHES(), "invalid batch index");
        require(!art.isBatchUploaded(batchIndex), "batch already uploaded");
        uint256 n = art.BATCH_SIZE();

        bytes memory bitmaps = new bytes(n * 200);
        bytes memory traits = new bytes(n * 8);

        for (uint256 i = 0; i < n; ++i) {
            uint256 tokenId = batchIndex * n + i + 1;
            string memory idStr = vm.toString(tokenId);

            bytes memory bin = vm.readFileBinary(string.concat(dir, "/", idStr, ".bin"));
            require(bin.length == 200, "bad .bin length");
            for (uint256 j = 0; j < 200; ++j) {
                bitmaps[i * 200 + j] = bin[j];
            }

            bytes memory tb = vm.parseBytes(_trim(vm.readFile(string.concat(dir, "/", idStr, ".traits"))));
            require(tb.length == 8, "bad .traits length");
            for (uint256 j = 0; j < 8; ++j) {
                traits[i * 8 + j] = tb[j];
            }
        }

        vm.startBroadcast(key);
        art.uploadArt(batchIndex, bitmaps, traits);
        vm.stopBroadcast();
        console.log("Uploaded batch", batchIndex);
    }

    function _trim(string memory value) internal pure returns (string memory) {
        bytes memory source = bytes(value);
        uint256 start;
        uint256 end = source.length;
        while (start < end && _isWhitespace(source[start])) ++start;
        while (end > start && _isWhitespace(source[end - 1])) --end;

        bytes memory trimmed = new bytes(end - start);
        for (uint256 i = start; i < end; ++i) trimmed[i - start] = source[i];
        return string(trimmed);
    }

    function _isWhitespace(bytes1 char) internal pure returns (bool) {
        return char == 0x20 || char == 0x09 || char == 0x0a || char == 0x0d;
    }
}
