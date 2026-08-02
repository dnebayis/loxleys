import { getAddress, isAddress, type Address } from 'viem';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

function address(value: string | undefined): Address {
  return value && isAddress(value) ? getAddress(value) : ZERO_ADDRESS;
}

function optionalAddress(value: string | undefined): Address | undefined {
  return value && isAddress(value) ? getAddress(value) : undefined;
}

export const contracts = {
  loxleysArt: address(import.meta.env.VITE_LOXLEYS_ART_ADDRESS),
  loxleysCanvas: address(import.meta.env.VITE_LOXLEYS_CANVAS_ADDRESS),
  agentExtensions: address(import.meta.env.VITE_AGENT_EXTENSIONS_ADDRESS),
  adapter8004: optionalAddress(import.meta.env.VITE_ADAPTER8004_ADDRESS),
} as const;

export const publicApiBaseUrl = (import.meta.env.VITE_PUBLIC_API_BASE_URL || 'http://localhost:8787').replace(/\/$/, '');
export const explorerBaseUrl = import.meta.env.VITE_EXPLORER_BASE_URL || 'https://robinhoodchain.blockscout.com';
