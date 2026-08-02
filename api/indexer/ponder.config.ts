import { createConfig } from 'ponder';
import { http, parseAbiItem, type Address } from 'viem';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

const startBlock = Number(process.env.PONDER_START_BLOCK || 0);
const adapterAddress = (process.env.ADAPTER8004_ADDRESS || '0x0000000000000000000000000000000000000000') as Address;

const Transfer = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)');
const MintClosed = parseAbiItem('event MintClosed(uint256 finalMintedSupply)');
const StartIndexRevealed = parseAbiItem('event StartIndexRevealed(uint256 startIndex)');
const OutlawSealed = parseAbiItem('event OutlawSealed(uint256 indexed tokenId, address indexed owner, address indexed sealedBy, uint16 alteredPixels, bytes32 overlayHash)');
const DelegateSet = parseAbiItem('event DelegateSet(uint256 indexed tokenId, address indexed owner, address indexed delegate)');
const ActiveIdentitySet = parseAbiItem('event ActiveIdentitySet(uint256 indexed tokenId, address indexed owner, bool outlawActive)');
const Remembered = parseAbiItem('event Remembered(uint256 indexed agentId, uint256 index, string entry)');
const AllianceRequested = parseAbiItem('event AllianceRequested(uint256 indexed fromAgent, uint256 indexed toAgent)');
const AllianceFormed = parseAbiItem('event AllianceFormed(uint256 indexed agentA, uint256 indexed agentB)');
const AllianceBroken = parseAbiItem('event AllianceBroken(uint256 indexed agentA, uint256 indexed agentB)');
const AgentBound = parseAbiItem('event AgentBound(uint256 indexed agentId, uint8 indexed standard, address indexed tokenContract, uint256 tokenId, address registeredBy)');

export default createConfig({
  chains: {
    robinhood: { id: 4663, rpc: http(required('ROBINHOOD_RPC_URL')) },
  },
  contracts: {
    LoxleysArt: { abi: [Transfer, MintClosed, StartIndexRevealed], chain: 'robinhood', address: required('LOXLEYS_ART_ADDRESS') as Address, startBlock },
    LoxleysCanvas: { abi: [OutlawSealed, DelegateSet, ActiveIdentitySet], chain: 'robinhood', address: required('LOXLEYS_CANVAS_ADDRESS') as Address, startBlock },
    AgentExtensions: { abi: [Remembered, AllianceRequested, AllianceFormed, AllianceBroken], chain: 'robinhood', address: required('AGENT_EXTENSIONS_ADDRESS') as Address, startBlock },
    Adapter8004: { abi: [AgentBound], chain: 'robinhood', address: adapterAddress, startBlock: Number(process.env.ADAPTER8004_START_BLOCK || startBlock) },
  },
});
