import type { Context } from 'hono';
import type { ApiConfig } from '../config.js';
import type { AgentRepository } from '../repository.js';
import { RobinhoodMcpClient } from './robinhood-client.js';
import { McpToolExecutor, toolDefinitions } from './tools.js';

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
};

function jsonrpcOk(id: string | number, result: unknown) {
  return { jsonrpc: '2.0' as const, id, result };
}

function jsonrpcError(id: string | number | null, code: number, message: string) {
  return { jsonrpc: '2.0' as const, id, error: { code, message } };
}

export function createMcpHandler(config: ApiConfig, repository: AgentRepository) {
  const robinhoodClient = new RobinhoodMcpClient(config);
  const executor = new McpToolExecutor(config, repository, robinhoodClient);

  return async function handleMcp(c: Context) {
    const body = await c.req.json<JsonRpcRequest>().catch(() => null);

    if (!body || body.jsonrpc !== '2.0' || !body.method) {
      return c.json(jsonrpcError(null, -32600, 'Invalid JSON-RPC request'), 400);
    }

    const { id, method, params } = body;

    switch (method) {
      case 'initialize':
        return c.json(jsonrpcOk(id, {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'loxleys-agent-trading',
            version: '1.0.0',
          },
          capabilities: {
            tools: { listChanged: false },
          },
        }));

      case 'tools/list':
        return c.json(jsonrpcOk(id, { tools: toolDefinitions }));

      case 'tools/call': {
        const toolName = String(params?.name || '');
        const args = (params?.arguments || {}) as Record<string, unknown>;
        const authToken = extractAuthToken(c);

        try {
          const result = await executor.execute(toolName, args, authToken ?? undefined);
          return c.json(jsonrpcOk(id, result));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Tool execution failed';
          return c.json(jsonrpcOk(id, {
            content: [{ type: 'text', text: message }],
            isError: true,
          }));
        }
      }

      case 'ping':
        return c.json(jsonrpcOk(id, {}));

      default:
        return c.json(jsonrpcError(id, -32601, `Method not found: ${method}`));
    }
  };
}

function extractAuthToken(c: Context): string | null {
  const header = c.req.header('authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export function mcpConfigSnippet(config: ApiConfig, tokenId?: string) {
  return {
    loxleys: {
      command: 'npx',
      args: ['-y', 'mcp-remote', `${config.publicApiBaseUrl}/mcp`],
      env: {
        LOXLEY_TOKEN_ID: tokenId || '1',
      },
    },
    robinhood: {
      url: config.robinhoodMcpEndpoint,
    },
  };
}
