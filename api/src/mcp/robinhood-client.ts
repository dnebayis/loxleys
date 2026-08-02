import type { ApiConfig } from '../config.js';

export type RobinhoodAuthToken = string;

export type PortfolioPosition = {
  symbol: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  totalValue: number;
  unrealizedPL: number;
};

export type PortfolioSummary = {
  accountValue: number;
  buyingPower: number;
  positions: PortfolioPosition[];
};

export type OrderRequest = {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  type: 'market' | 'limit';
  limitPrice?: number;
};

export type OrderResult = {
  orderId: string;
  status: 'placed' | 'rejected';
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  type: 'market' | 'limit';
  limitPrice?: number;
  message?: string;
  timestamp: string;
};

export type TradeHistoryEntry = {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  status: string;
  timestamp: string;
};

type McpJsonRpcRequest = {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
};

type McpJsonRpcResponse = {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
};

let requestIdCounter = 0;

async function mcpCall(
  endpoint: string,
  method: string,
  params: Record<string, unknown>,
  authToken: RobinhoodAuthToken,
): Promise<unknown> {
  const body: McpJsonRpcRequest = {
    jsonrpc: '2.0',
    id: ++requestIdCounter,
    method,
    params,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Robinhood MCP error: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as McpJsonRpcResponse;
  if (payload.error) {
    throw new Error(`Robinhood MCP: ${payload.error.message} (${payload.error.code})`);
  }

  return payload.result;
}

export class RobinhoodMcpClient {
  private readonly endpoint: string;

  constructor(config: ApiConfig) {
    this.endpoint = config.robinhoodMcpEndpoint;
  }

  async getPortfolio(authToken: RobinhoodAuthToken): Promise<PortfolioSummary> {
    const result = await mcpCall(this.endpoint, 'tools/call', {
      name: 'get_portfolio',
      arguments: {},
    }, authToken);
    return result as PortfolioSummary;
  }

  async placeOrder(authToken: RobinhoodAuthToken, order: OrderRequest): Promise<OrderResult> {
    const result = await mcpCall(this.endpoint, 'tools/call', {
      name: 'place_order',
      arguments: order,
    }, authToken);
    return result as OrderResult;
  }

  async getTradeHistory(authToken: RobinhoodAuthToken, limit = 20): Promise<TradeHistoryEntry[]> {
    const result = await mcpCall(this.endpoint, 'tools/call', {
      name: 'get_trade_history',
      arguments: { limit },
    }, authToken);
    return result as TradeHistoryEntry[];
  }

  async getAccountInfo(authToken: RobinhoodAuthToken): Promise<Record<string, unknown>> {
    const result = await mcpCall(this.endpoint, 'tools/call', {
      name: 'get_account_info',
      arguments: {},
    }, authToken);
    return result as Record<string, unknown>;
  }
}
