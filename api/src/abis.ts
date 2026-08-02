import { parseAbi } from 'viem';

export const artAbi = parseAbi([
  'function owner() view returns (address)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function startIndex() view returns (uint256)',
  'function startIndexSet() view returns (bool)',
  'function mintClosed() view returns (bool)',
  'function maxSupply() view returns (uint256)',
  'function canvas() view returns (address)',
  'function extensions() view returns (address)',
  'function renderer() view returns (address)',
  'function animationBaseURI() view returns (string)',
  'function isBatchUploaded(uint256 batchIndex) view returns (bool)',
  'function baseBitmap(uint256 tokenId) view returns (bytes)',
  'function outlawBitmap(uint256 tokenId) view returns (bytes)',
  'function renderedBitmap(uint256 tokenId) view returns (bytes)',
  'function traitsOf(uint256 tokenId) view returns (bytes8)',
  'function personaOf(uint256 tokenId) view returns (string)',
  'function tokenURI(uint256 tokenId) view returns (string)',
]);

export const canvasAbi = parseAbi([
  'function owner() view returns (address)',
  'function privilegedArtist() view returns (address)',
  'function delegateOf(uint256 tokenId) view returns (address)',
  'function overlayOf(uint256 tokenId) view returns (bytes)',
  'function isSealed(uint256 tokenId) view returns (bool)',
  'function isOutlawActive(uint256 tokenId) view returns (bool)',
  'function alteredPixels(uint256 tokenId) view returns (uint16)',
  'function overlayHash(uint256 tokenId) view returns (bytes32)',
]);

export const extensionsAbi = parseAbi([
  'function owner() view returns (address)',
  'function memoriesOf(uint256 agentId) view returns (string[])',
  'function alliesOf(uint256 agentId) view returns (uint256[])',
  'function hasPendingRequest(uint256 fromAgent, uint256 toAgent) view returns (bool)',
]);
