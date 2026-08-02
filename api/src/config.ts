import { getAddress, isAddress, type Address } from 'viem';

export type ApiConfig = {
  publicApiBaseUrl: string;
  rpcUrl: string;
  ponderGraphqlUrl: string;
  adapterAddress?: Address;
  artAddress?: Address;
  canvasAddress?: Address;
  extensionsAddress?: Address;
  robinhoodMcpEndpoint: string;
};

function optionalAddress(value: string | undefined): Address | undefined {
  return value && isAddress(value) ? getAddress(value) : undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    publicApiBaseUrl: (env.PUBLIC_API_BASE_URL || 'http://localhost:8787').replace(/\/$/, ''),
    rpcUrl: env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com',
    ponderGraphqlUrl: env.PONDER_GRAPHQL_URL || 'http://localhost:42069/graphql',
    adapterAddress: optionalAddress(env.ADAPTER8004_ADDRESS),
    artAddress: optionalAddress(env.LOXLEYS_ART_ADDRESS),
    canvasAddress: optionalAddress(env.LOXLEYS_CANVAS_ADDRESS),
    extensionsAddress: optionalAddress(env.AGENT_EXTENSIONS_ADDRESS),
    robinhoodMcpEndpoint: env.ROBINHOOD_MCP_ENDPOINT || 'https://agent.robinhood.com/mcp/trading',
  };
}
