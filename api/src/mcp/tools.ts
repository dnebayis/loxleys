import type { AgentRepository, AgentState } from '../repository.js';
import type { ApiConfig } from '../config.js';
import type { RobinhoodMcpClient, RobinhoodAuthToken, OrderRequest, OrderResult, PortfolioSummary, TradeHistoryEntry } from './robinhood-client.js';

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type McpToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

function textResult(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export const toolDefinitions: McpToolDefinition[] = [
  {
    name: 'get_agent_identity',
    description: 'Get the on-chain identity, traits, persona, capabilities, Canvas state, and memories of a Loxley agent NFT.',
    inputSchema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string', description: 'Loxley NFT token ID (1-2000)' },
      },
      required: ['tokenId'],
    },
  },
  {
    name: 'get_portfolio',
    description: 'Get the portfolio summary from the connected Robinhood agentic trading account — positions, values, and buying power.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'place_order',
    description: 'Place a trade order through the connected Robinhood agentic account. The order is proxied to Robinhood MCP and logged as an on-chain agent memory.',
    inputSchema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string', description: 'Loxley agent token ID that authorizes this trade' },
        symbol: { type: 'string', description: 'Stock ticker symbol (e.g. AAPL, TSLA)' },
        side: { type: 'string', enum: ['buy', 'sell'], description: 'Buy or sell' },
        quantity: { type: 'number', description: 'Number of shares' },
        type: { type: 'string', enum: ['market', 'limit'], description: 'Order type' },
        limitPrice: { type: 'number', description: 'Limit price (required for limit orders)' },
      },
      required: ['tokenId', 'symbol', 'side', 'quantity', 'type'],
    },
  },
  {
    name: 'get_trade_history',
    description: 'Get recent trade history from the connected Robinhood agentic account.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max number of trades to return (default 20)' },
      },
    },
  },
  {
    name: 'log_trade_memory',
    description: 'Log a trade decision or rationale as an on-chain memory for a Loxley agent. Uses compact format: ACTION:SYMBOL:PRICE:QTY',
    inputSchema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string', description: 'Loxley agent token ID' },
        entry: { type: 'string', description: 'Compact trade memory (max 96 bytes). Format: BUY:AAPL:150.25:10sh or SELL:TSLA:220.00:5sh' },
      },
      required: ['tokenId', 'entry'],
    },
  },
  {
    name: 'get_alliances',
    description: 'Get the mutual alliances of a Loxley agent — allied agents can share trading signals.',
    inputSchema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string', description: 'Loxley agent token ID' },
      },
      required: ['tokenId'],
    },
  },
];

export class McpToolExecutor {
  constructor(
    private readonly config: ApiConfig,
    private readonly repository: AgentRepository,
    private readonly robinhoodClient: RobinhoodMcpClient,
  ) {}

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    authToken?: RobinhoodAuthToken,
  ): Promise<McpToolResult> {
    switch (toolName) {
      case 'get_agent_identity':
        return this.getAgentIdentity(args);
      case 'get_portfolio':
        return this.getPortfolio(authToken);
      case 'place_order':
        return this.placeOrder(args, authToken);
      case 'get_trade_history':
        return this.getTradeHistory(args, authToken);
      case 'log_trade_memory':
        return this.logTradeMemory(args);
      case 'get_alliances':
        return this.getAlliances(args);
      default:
        return errorResult(`Unknown tool: ${toolName}`);
    }
  }

  private async getAgentIdentity(args: Record<string, unknown>): Promise<McpToolResult> {
    const tokenId = this.parseTokenId(args.tokenId);
    if (!tokenId) return errorResult('Invalid tokenId');

    const state = await this.repository.getState(tokenId);
    return textResult({
      tokenId: state.tokenId,
      owner: state.owner,
      persona: state.persona,
      traits: state.traits,
      capabilities: state.capabilities,
      canvas: {
        sealed: state.canvas.sealed,
        activeIdentity: state.canvas.activeIdentity,
        alteredPixels: state.canvas.alteredPixels,
      },
      memories: state.memories,
      allies: state.allies,
      image: state.image,
    });
  }

  private async getPortfolio(authToken?: RobinhoodAuthToken): Promise<McpToolResult> {
    if (!authToken) return errorResult('Robinhood auth token required. Connect your agentic account first.');
    const portfolio = await this.robinhoodClient.getPortfolio(authToken);
    return textResult(portfolio);
  }

  private async placeOrder(args: Record<string, unknown>, authToken?: RobinhoodAuthToken): Promise<McpToolResult> {
    if (!authToken) return errorResult('Robinhood auth token required. Connect your agentic account first.');

    const tokenId = this.parseTokenId(args.tokenId);
    if (!tokenId) return errorResult('Invalid tokenId — a Loxley agent must authorize the trade.');

    const symbol = typeof args.symbol === 'string' ? args.symbol.trim().toUpperCase() : '';
    const side = args.side;
    const quantity = Number(args.quantity);
    const type = args.type;
    const limitPrice = Number(args.limitPrice);
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) return errorResult('Invalid symbol');
    if (side !== 'buy' && side !== 'sell') return errorResult('Invalid side');
    if (!Number.isFinite(quantity) || quantity <= 0) return errorResult('Quantity must be a positive number');
    if (type !== 'market' && type !== 'limit') return errorResult('Invalid order type');
    if (type === 'limit' && (!Number.isFinite(limitPrice) || limitPrice <= 0)) {
      return errorResult('A positive limitPrice is required for limit orders');
    }

    const order: OrderRequest = { symbol, side, quantity, type };
    if (type === 'limit') order.limitPrice = limitPrice;

    const result = await this.robinhoodClient.placeOrder(authToken, order);

    const memoryEntry = formatTradeMemory(result);
    return textResult({
      order: result,
      memoryEntry,
      note: `Trade logged. To persist on-chain, call log_trade_memory with tokenId=${args.tokenId} and entry="${memoryEntry}"`,
    });
  }

  private async getTradeHistory(args: Record<string, unknown>, authToken?: RobinhoodAuthToken): Promise<McpToolResult> {
    if (!authToken) return errorResult('Robinhood auth token required. Connect your agentic account first.');
    const limit = Number(args.limit) || 20;
    const history = await this.robinhoodClient.getTradeHistory(authToken, limit);
    return textResult(history);
  }

  private async logTradeMemory(args: Record<string, unknown>): Promise<McpToolResult> {
    const tokenId = this.parseTokenId(args.tokenId);
    if (!tokenId) return errorResult('Invalid tokenId');

    const entry = String(args.entry || '');
    if (!entry || Buffer.byteLength(entry, 'utf8') > 96 || !/^[\x20-\x7e]+$/.test(entry)) {
      return errorResult('Memory entry must be 1-96 printable ASCII bytes');
    }

    return textResult({
      tokenId: tokenId.toString(),
      entry,
      instruction: 'Submit this memory on-chain by calling AgentExtensions.remember(tokenId, entry) from the token owner wallet.',
      contractAddress: this.config.extensionsAddress || 'extensions_not_configured',
    });
  }

  private async getAlliances(args: Record<string, unknown>): Promise<McpToolResult> {
    const tokenId = this.parseTokenId(args.tokenId);
    if (!tokenId) return errorResult('Invalid tokenId');

    const state = await this.repository.getState(tokenId);
    return textResult({
      tokenId: state.tokenId,
      allyCount: state.allies.length,
      allies: state.allies,
    });
  }

  private parseTokenId(raw: unknown): bigint | null {
    try {
      const id = BigInt(String(raw));
      return id > 0n && id <= 2000n ? id : null;
    } catch {
      return null;
    }
  }
}

function formatTradeMemory(order: OrderResult): string {
  const side = order.side.toUpperCase();
  const price = order.limitPrice ?? '~MKT';
  return `${side}:${order.symbol}:${price}:${order.quantity}sh`;
}
