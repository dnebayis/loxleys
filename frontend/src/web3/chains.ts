import { defineChain } from 'viem';

const configuredChainId = Number(import.meta.env.VITE_CHAIN_ID || 4663);
const isTestnet = configuredChainId === 46630;

export const robinhoodChain = defineChain({
  id: configuredChainId,
  name: isTestnet ? 'Robinhood Chain Testnet' : 'Robinhood Chain',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [
        import.meta.env.VITE_ROBINHOOD_RPC_URL ||
          (isTestnet
            ? 'https://rpc.testnet.chain.robinhood.com'
            : 'https://rpc.mainnet.chain.robinhood.com'),
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'Robinhood Explorer',
      url: isTestnet
        ? 'https://explorer.testnet.chain.robinhood.com'
        : 'https://robinhoodchain.blockscout.com',
    },
  },
  testnet: isTestnet,
});
