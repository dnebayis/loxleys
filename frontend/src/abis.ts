export const loxleysArtAbi = [
  { type: 'event', name: 'Transfer', inputs: [{ name: 'from', type: 'address', indexed: true }, { name: 'to', type: 'address', indexed: true }, { name: 'tokenId', type: 'uint256', indexed: true }] },
  { type: 'function', name: 'BATCH_SIZE', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'MAX_SUPPLY', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'NUM_BATCHES', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'PUBLIC_SUPPLY', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'SPECIAL_RESERVE', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'startIndexSet', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'mintClosed', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'maxSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'isBatchUploaded', stateMutability: 'view', inputs: [{ name: 'batchIndex', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'baseBitmap', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'outlawBitmap', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'renderedBitmap', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'personaOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'tokenURI', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'string' }] },
] as const;

export const loxleysCanvasAbi = [
  { type: 'function', name: 'delegateOf', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'MAX_ALTERED_PIXELS', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'MAX_PRIVILEGED_ARTIST_PIXELS', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'privilegedArtist', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'maxAlteredPixelsFor', stateMutability: 'view', inputs: [{ name: 'operator', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'overlayOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'isSealed', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'isOutlawActive', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'alteredPixels', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'overlayHash', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  {
    type: 'function',
    name: 'sealOutlaw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'xorOverlay', type: 'bytes' },
    ],
    outputs: [],
  },
  { type: 'function', name: 'setDelegate', stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }, { name: 'delegate', type: 'address' }], outputs: [] },
  { type: 'function', name: 'setActiveIdentity', stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }, { name: 'outlawActive', type: 'bool' }], outputs: [] },
] as const;

export const adapter8004Abi = [
  {
    type: 'function', name: 'register', stateMutability: 'nonpayable',
    inputs: [
      { name: 'standard', type: 'uint8' },
      { name: 'tokenContract', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'agentURI', type: 'string' },
    ],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
] as const;

export const extensionsAbi = [
  { type: 'function', name: 'MAX_ALLIES', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'MAX_MEMORIES', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'MAX_ENTRY_LEN', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'memoryCount', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'alliesOf', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ type: 'uint256[]' }] },
  { type: 'function', name: 'remember', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'entry', type: 'string' }], outputs: [] },
  { type: 'function', name: 'requestAlliance', stateMutability: 'nonpayable', inputs: [{ name: 'fromAgent', type: 'uint256' }, { name: 'toAgent', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'acceptAlliance', stateMutability: 'nonpayable', inputs: [{ name: 'toAgent', type: 'uint256' }, { name: 'fromAgent', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'breakAlliance', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'other', type: 'uint256' }], outputs: [] },
] as const;
