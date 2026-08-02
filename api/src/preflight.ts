import 'dotenv/config';
import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem';
import { artAbi, canvasAbi, extensionsAbi } from './abis.js';
import { loadConfig } from './config.js';
import { robinhoodChain } from './robinhood.js';

type Status = 'pass' | 'warn' | 'fail';
type Check = { name: string; status: Status; detail: string };

const EXPECTED_CHAIN_ID = 4663;
const EXPECTED_MAX_SUPPLY = 2_000n;
const EXPECTED_ART_BATCHES = 20;
const production = new Set(process.argv.slice(2)).has('--production');
const config = loadConfig();
const checks: Check[] = [];

function add(status: Status, name: string, detail: string) {
  checks.push({ status, name, detail });
}

function detail(value: Address | undefined): string {
  return value ? getAddress(value) : 'missing';
}

function sameAddress(a: Address | string, b: Address | undefined): boolean {
  return Boolean(b && isAddress(a) && getAddress(a) === getAddress(b));
}

function validateStaticConfig() {
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(config.publicApiBaseUrl);
  add(production && (local || !config.publicApiBaseUrl.startsWith('https://')) ? 'fail' : local ? 'warn' : 'pass',
    'PUBLIC_API_BASE_URL', config.publicApiBaseUrl);

  for (const [name, value] of [
    ['LOXLEYS_ART_ADDRESS', config.artAddress],
    ['LOXLEYS_CANVAS_ADDRESS', config.canvasAddress],
    ['AGENT_EXTENSIONS_ADDRESS', config.extensionsAddress],
  ] as const) add(value ? 'pass' : 'fail', name, detail(value));

  add(config.adapterAddress ? 'pass' : 'warn', 'ADAPTER8004_ADDRESS',
    config.adapterAddress ? detail(config.adapterAddress) : 'deferred until an official registry is available');
}

async function validateLiveContracts() {
  if (!config.artAddress || !config.canvasAddress || !config.extensionsAddress) return;
  const client = createPublicClient({ chain: robinhoodChain, transport: http(config.rpcUrl) });
  const chainId = await client.getChainId();
  add(chainId === EXPECTED_CHAIN_ID ? 'pass' : 'fail', 'chain id', String(chainId));

  const [maxSupply, totalSupply, mintClosed, revealed, canvas, extensions, renderer, firstBatch, lastBatch,
    artOwner, canvasOwner, extensionsOwner, privilegedArtist] = await Promise.all([
    client.readContract({ address: config.artAddress, abi: artAbi, functionName: 'maxSupply' }),
    client.readContract({ address: config.artAddress, abi: artAbi, functionName: 'totalSupply' }),
    client.readContract({ address: config.artAddress, abi: artAbi, functionName: 'mintClosed' }),
    client.readContract({ address: config.artAddress, abi: artAbi, functionName: 'startIndexSet' }),
    client.readContract({ address: config.artAddress, abi: artAbi, functionName: 'canvas' }),
    client.readContract({ address: config.artAddress, abi: artAbi, functionName: 'extensions' }),
    client.readContract({ address: config.artAddress, abi: artAbi, functionName: 'renderer' }),
    client.readContract({ address: config.artAddress, abi: artAbi, functionName: 'isBatchUploaded', args: [0n] }),
    client.readContract({ address: config.artAddress, abi: artAbi, functionName: 'isBatchUploaded', args: [BigInt(EXPECTED_ART_BATCHES - 1)] }),
    client.readContract({ address: config.artAddress, abi: artAbi, functionName: 'owner' }),
    client.readContract({ address: config.canvasAddress, abi: canvasAbi, functionName: 'owner' }),
    client.readContract({ address: config.extensionsAddress, abi: extensionsAbi, functionName: 'owner' }),
    client.readContract({ address: config.canvasAddress, abi: canvasAbi, functionName: 'privilegedArtist' }),
  ]);

  add(maxSupply === EXPECTED_MAX_SUPPLY ? 'pass' : 'fail', 'max supply', maxSupply.toString());
  add(totalSupply <= EXPECTED_MAX_SUPPLY ? 'pass' : 'fail', 'minted supply', totalSupply.toString());
  add(sameAddress(canvas, config.canvasAddress) ? 'pass' : 'fail', 'Art.canvas wiring', String(canvas));
  add(sameAddress(extensions, config.extensionsAddress) ? 'pass' : 'fail', 'Art.extensions wiring', String(extensions));
  add(renderer !== '0x0000000000000000000000000000000000000000' ? 'pass' : 'fail', 'Art.renderer wiring', String(renderer));
  add(firstBatch && lastBatch ? 'pass' : 'fail', 'art batches', firstBatch && lastBatch ? 'batch 0 and 19 uploaded' : 'incomplete');
  const ownersMatch = sameAddress(artOwner, canvasOwner) && sameAddress(artOwner, extensionsOwner);
  add(ownersMatch ? 'pass' : 'fail', 'module ownership',
    `Art ${artOwner}; Canvas ${canvasOwner}; Extensions ${extensionsOwner}`);
  add(sameAddress(artOwner, privilegedArtist) ? 'pass' : 'fail', 'Canvas privileged artist', String(privilegedArtist));
  add('pass', 'sale state', mintClosed ? (revealed ? 'mint closed; revealed' : 'mint closed; reveal pending') : 'mint open; placeholder active');
}

async function main() {
  validateStaticConfig();
  try { await validateLiveContracts(); }
  catch (error) { add('fail', 'live RPC checks', error instanceof Error ? error.message : 'unknown error'); }
  for (const check of checks) console.log(`${check.status.toUpperCase().padEnd(4)} ${check.name}: ${check.detail}`);
  if (checks.some((check) => check.status === 'fail')) process.exitCode = 1;
}

void main();
