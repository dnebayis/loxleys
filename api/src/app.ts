import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ApiConfig } from './config.js';
import type { AgentBinding, AgentRepository, AgentState } from './repository.js';
import { createMcpHandler, mcpConfigSnippet } from './mcp/index.js';

function parseId(raw: string): bigint | null {
  try { const id = BigInt(raw); return id > 0n ? id : null; } catch { return null; }
}

export function createApp(config: ApiConfig, repository: AgentRepository) {
  const app = new Hono();
  app.use('*', cors());

  app.onError((error, c) => c.json({ error: error.message }, 503));

  const routes = [
    '/health', '/openapi.json', '/.well-known/agent.json', '/agents/metadata/{tokenId}',
    '/agents/info/{tokenId}', '/agents/agent-card/{tokenId}', '/agents/binding/{tokenId}',
    '/agents/readiness/{tokenId}',
    '/agents/{tokenId}/canvas', '/agents/{tokenId}/memories', '/agents/{tokenId}/capabilities',
    '/agents/{tokenId}/alliances', '/agents/{tokenId}/prompt.txt', '/agents/by-agent-id/{agentId}', '/agents/by-owner/{address}', '/agents/list',
    '/agents/{tokenId}/trading', '/mcp', '/mcp/config/{tokenId}',
    '/llms.txt', '/tokens/{tokenId}/identity',
  ];

  app.get('/', (c) => c.json({ name: 'Loxleys Agent API', version: '3.0.0', documentation: `${config.publicApiBaseUrl}/openapi.json`, routes }));

  app.get('/health', (c) => c.json({
    status: 'ok', chainId: 4663,
    adapter: config.adapterAddress ? 'configured' : 'adapter_not_configured',
    contracts: { art: Boolean(config.artAddress), canvas: Boolean(config.canvasAddress), extensions: Boolean(config.extensionsAddress) },
  }));

  app.get('/.well-known/agent.json', (c) => c.json({
    name: 'Loxleys', description: 'Owner-controlled on-chain pixel agents on Robinhood Chain',
    api: config.publicApiBaseUrl, openapi: `${config.publicApiBaseUrl}/openapi.json`,
    metadataTemplate: `${config.publicApiBaseUrl}/agents/metadata/{tokenId}`,
    adapterStatus: config.adapterAddress ? 'configured' : 'adapter_not_configured',
  }));

  app.get('/openapi.json', (c) => c.json(openApiDocument(config.publicApiBaseUrl, routes)));

  app.get('/agents/binding/:tokenId', async (c) => {
    const tokenId = parseId(c.req.param('tokenId'));
    if (!tokenId) return c.json({ error: 'invalid_token_id' }, 400);
    if (!config.adapterAddress) return c.json({ status: 'adapter_not_configured', binding: null });
    const binding = await repository.getBinding(tokenId);
    return c.json({ status: binding ? 'registered' : 'not_registered', binding });
  });

  app.get('/agents/info/:tokenId', async (c) => {
    const tokenId = parseId(c.req.param('tokenId'));
    if (!tokenId) return c.json({ error: 'invalid_token_id' }, 400);
    const [state, binding] = await Promise.all([
      repository.getState(tokenId),
      config.adapterAddress ? repository.getBinding(tokenId) : Promise.resolve(null),
    ]);
    return c.json({ ...state, adapterStatus: !config.adapterAddress ? 'adapter_not_configured' : binding ? 'registered' : 'not_registered', binding });
  });

  app.get('/agents/readiness/:tokenId', async (c) => {
    const tokenId = parseId(c.req.param('tokenId'));
    if (!tokenId) return c.json({ error: 'invalid_token_id' }, 400);
    const [state, binding] = await Promise.all([
      repository.getState(tokenId),
      config.adapterAddress ? repository.getBinding(tokenId) : Promise.resolve(null),
    ]);
    return c.json(agentReadiness(config, state, binding));
  });

  app.get('/agents/metadata/:tokenId', async (c) => {
    const tokenId = parseId(c.req.param('tokenId'));
    if (!tokenId) return c.json({ error: 'invalid_token_id' }, 400);
    const state = await repository.getState(tokenId);
    return c.json({
      name: `Loxley #${tokenId}`,
      description: state.persona,
      image: state.image,
      active: true,
      services: [{ name: 'A2A', endpoint: `${config.publicApiBaseUrl}/agents/agent-card/${tokenId}`, version: '0.3.0' }],
      registrations: config.adapterAddress ? [{ standard: 0, registry: config.adapterAddress }] : [],
      supportedTrust: ['reputation'],
      extensions: { memories: state.memories, capabilities: state.capabilities, alliances: state.allies, canvas: state.canvas },
    });
  });

  app.get('/agents/agent-card/:tokenId', async (c) => {
    const tokenId = parseId(c.req.param('tokenId'));
    if (!tokenId) return c.json({ error: 'invalid_token_id' }, 400);
    const state = await repository.getState(tokenId);
    return c.json({
      name: `Loxley #${tokenId}`, description: state.persona,
      url: `${config.publicApiBaseUrl}/agents/info/${tokenId}`,
      version: '2.0.0', protocolVersion: '0.3.0',
      capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: true },
      skills: state.capabilities.map((capability) => ({ id: capability.id, name: capability.name, description: capability.trait, tags: ['traits', 'onchain'] })),
      defaultInputModes: ['application/json'], defaultOutputModes: ['application/json'],
    });
  });

  app.get('/agents/:tokenId/canvas', async (c) => {
    const tokenId = parseId(c.req.param('tokenId'));
    if (!tokenId) return c.json({ error: 'invalid_token_id' }, 400);
    const state = await repository.getState(tokenId);
    return c.json({ tokenId: state.tokenId, image: state.image, canvas: state.canvas });
  });

  app.get('/tokens/:tokenId/identity', async (c) => {
    const tokenId = parseId(c.req.param('tokenId'));
    if (!tokenId) return c.json({ error: 'invalid_token_id' }, 400);
    const state = await repository.getState(tokenId);
    return c.html(identityDocument(state.tokenId, state.canvas.publicImage, state.canvas.outlawImage, state.canvas.sealed, state.canvas.activeIdentity));
  });

  app.get('/agents/:tokenId/memories', async (c) => {
    const tokenId = parseId(c.req.param('tokenId'));
    if (!tokenId) return c.json({ error: 'invalid_token_id' }, 400);
    const state = await repository.getState(tokenId);
    return c.json({ tokenId: state.tokenId, count: state.memories.length, memories: state.memories });
  });

  app.get('/agents/:tokenId/capabilities', async (c) => {
    const tokenId = parseId(c.req.param('tokenId'));
    if (!tokenId) return c.json({ error: 'invalid_token_id' }, 400);
    const state = await repository.getState(tokenId);
    return c.json({ tokenId: state.tokenId, source: 'traits', count: state.capabilities.length, capabilities: state.capabilities });
  });

  app.get('/agents/:tokenId/alliances', async (c) => {
    const tokenId = parseId(c.req.param('tokenId'));
    if (!tokenId) return c.json({ error: 'invalid_token_id' }, 400);
    const allianceState = await repository.getAllianceState(tokenId);
    return c.json({ tokenId: tokenId.toString(), count: allianceState.allies.length, ...allianceState });
  });

  app.get('/agents/:tokenId/prompt.txt', async (c) => {
    const tokenId = parseId(c.req.param('tokenId'));
    if (!tokenId || tokenId > 2000n) return c.text('invalid_token_id', 400);
    return c.text(agentPrompt(config.publicApiBaseUrl, tokenId.toString()));
  });

  app.get('/agents/by-agent-id/:agentId', async (c) => {
    const agentId = parseId(c.req.param('agentId'));
    if (!agentId) return c.json({ error: 'invalid_agent_id' }, 400);
    if (!config.adapterAddress) return c.json({ status: 'adapter_not_configured', binding: null });
    const binding = await repository.getBindingByAgentId(agentId);
    return c.json({ status: binding ? 'registered' : 'not_registered', binding });
  });

  app.get('/agents/list', async (c) => {
    if (!config.adapterAddress) return c.json({ status: 'adapter_not_configured', agents: [] });
    const requested = Number(c.req.query('limit') || 50);
    const agents = await repository.listBindings(Math.min(100, Math.max(1, requested)));
    return c.json({ status: 'ok', agents });
  });

  app.get('/agents/by-owner/:address', async (c) => {
    const addr = c.req.param('address');
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return c.json({ error: 'invalid_address' }, 400);
    try {
      const tokenIds = await repository.getTokensByOwner(addr as `0x${string}`);
      return c.json({ owner: addr, tokenIds });
    } catch {
      return c.json({ owner: addr, tokenIds: [] });
    }
  });

  // ---- Agentic Trading ----

  app.get('/agents/:tokenId/trading', async (c) => {
    const tokenId = parseId(c.req.param('tokenId'));
    if (!tokenId) return c.json({ error: 'invalid_token_id' }, 400);
    const id = tokenId.toString();

    let state: Awaited<ReturnType<typeof repository.getState>> | null = null;
    try { state = await repository.getState(tokenId); } catch {}

    const tradeMemories = state?.memories.filter((m) => /^(BUY|SELL):/.test(m)) ?? [];
    return c.json({
      tokenId: id,
      owner: state?.owner ?? null,
      persona: state?.persona ?? null,
      capabilities: state?.capabilities ?? [],
      tradingEnabled: true,
      robinhoodMcp: config.robinhoodMcpEndpoint,
      mcpConfig: mcpConfigSnippet(config, id),
      tradeMemories,
      totalMemories: state?.memories.length ?? 0,
      maxMemories: 32,
    });
  });

  const mcpHandler = createMcpHandler(config, repository);
  app.post('/mcp', mcpHandler);

  app.get('/mcp/config/:tokenId', (c) => {
    const parsedTokenId = parseId(c.req.param('tokenId'));
    if (!parsedTokenId || parsedTokenId > 2000n) return c.json({ error: 'invalid_token_id' }, 400);
    const tokenId = parsedTokenId.toString();
    return c.json({
      description: 'MCP configuration for AI agents (Claude, ChatGPT, Grok, Cursor)',
      mcpServers: mcpConfigSnippet(config, tokenId),
      instructions: [
        'Add the "loxleys" block to your MCP config (claude_desktop_config.json, .cursor/mcp.json, etc.)',
        'Set your Robinhood agentic account auth token as the Authorization header',
        'The agent will have access to your Loxley identity, trading tools, and on-chain memory',
      ],
    });
  });

  app.get('/llms.txt', (c) => c.text([
    '# Loxleys Agent API',
    `Base URL: ${config.publicApiBaseUrl}`,
    'GET /agents/metadata/{tokenId} - ERC-8004 agent metadata',
    'GET /agents/info/{tokenId} - combined on-chain agent state',
    'GET /agents/readiness/{tokenId} - production readiness for metadata, A2A, Adapter8004, Canvas and OpenSea embed',
    'GET /agents/agent-card/{tokenId} - A2A Agent Card',
    'GET /agents/binding/{tokenId} - Adapter8004 binding status',
    'GET /agents/{tokenId}/canvas - rendered image and canvas state',
    'GET /tokens/{tokenId}/identity - Public and Outlaw identity embed',
    'GET /agents/{tokenId}/memories - memory entries',
    'GET /agents/{tokenId}/capabilities - trait-derived, non-assignable capabilities',
    'GET /agents/{tokenId}/alliances - accepted allies',
    'GET /agents/{tokenId}/prompt.txt - short copy-ready context prompt for any LLM',
    'GET /agents/{tokenId}/trading - trading status, MCP config, and compact trade memories',
    'POST /mcp - MCP JSON-RPC endpoint for AI agent connections (tools: get_agent_identity, get_portfolio, place_order, get_trade_history, log_trade_memory, get_alliances)',
    'GET /mcp/config/{tokenId} - MCP config snippet for Claude, ChatGPT, Grok, Cursor',
    'GET /agents/by-agent-id/{agentId} - resolve an Adapter8004 agent ID',
    'GET /agents/by-owner/{address} - list token IDs owned by an address',
    'GET /agents/list?limit=50 - list registered Loxleys agents',
    'GET /openapi.json - OpenAPI 3.1 service description',
  ].join('\n')));

  return app;
}

function agentReadiness(config: ApiConfig, state: AgentState, binding: AgentBinding | null) {
  const agentUri = `${config.publicApiBaseUrl}/agents/metadata/${state.tokenId}`;
  const agentCardUrl = `${config.publicApiBaseUrl}/agents/agent-card/${state.tokenId}`;
  const identityUrl = `${config.publicApiBaseUrl}/tokens/${state.tokenId}/identity`;
  const metadata = tokenMetadata(state.tokenUri);
  const publicApiHosted = isHostedHttps(config.publicApiBaseUrl);
  const expectedRegistration = config.adapterAddress ? { standard: 0, registry: config.adapterAddress, agentUri } : null;
  const checks = [
    readinessCheck('metadata', state.image ? 'pass' : 'fail', agentUri),
    readinessCheck('agent_card', 'pass', agentCardUrl),
    readinessCheck('public_api', publicApiHosted ? 'pass' : 'warn', config.publicApiBaseUrl),
    readinessCheck('adapter8004', config.adapterAddress ? 'pass' : 'warn', config.adapterAddress || 'adapter_not_configured'),
    readinessCheck('binding', !config.adapterAddress ? 'warn' : binding ? 'pass' : 'warn', binding ? `agentId ${binding.agentId}` : 'not_registered'),
    readinessCheck('canvas', state.canvas.sealed ? 'pass' : 'warn', state.canvas.sealed ? `${state.canvas.activeIdentity} active, ${state.canvas.alteredPixels} pixels sealed` : 'public identity only'),
    readinessCheck('capabilities', 'pass', `${state.capabilities.length} trait-derived capabilities`),
    readinessCheck('extensions', 'pass', `runtime state: ${state.memories.length} memories, ${state.allies.length} allies`),
    readinessCheck('opensea_identity_embed', metadata.animation_url === identityUrl ? 'pass' : 'warn', metadata.animation_url || 'animation_url_not_set'),
  ];
  return {
    tokenId: state.tokenId,
    owner: state.owner,
    controller: state.controller,
    status: checks.some((check) => check.status === 'fail') ? 'blocked' : checks.some((check) => check.status === 'warn') ? 'pending' : 'ready',
    agentUri,
    agentCardUrl,
    identityUrl,
    expectedRegistration,
    binding,
    capabilities: state.capabilities,
    checks,
  };
}

function readinessCheck(name: string, status: 'pass' | 'warn' | 'fail', detail: string) {
  return { name, status, detail };
}

function isHostedHttps(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function tokenMetadata(tokenUri: string): { animation_url?: string } {
  const prefix = 'data:application/json;base64,';
  if (!tokenUri.startsWith(prefix)) return {};
  try {
    return JSON.parse(Buffer.from(tokenUri.slice(prefix.length), 'base64').toString('utf8')) as { animation_url?: string };
  } catch {
    return {};
  }
}

function openApiDocument(baseUrl: string, routes: string[]) {
  const paths = Object.fromEntries(routes.filter((route) => route !== '/llms.txt' && route !== '/mcp').map((route) => [route, {
    get: { summary: route, responses: { '200': { description: 'Successful response' }, '400': { description: 'Invalid identifier' }, '503': { description: 'Dependency unavailable' } } },
  }]));
  return {
    openapi: '3.1.0', info: { title: 'Loxleys Agent API', version: '3.0.0' },
    servers: [{ url: baseUrl }], paths: {
      ...paths,
      '/mcp': { post: { summary: 'MCP JSON-RPC endpoint', responses: { '200': { description: 'JSON-RPC response' }, '401': { description: 'Robinhood authorization required for account tools' } } } },
    },
  };
}

function agentPrompt(baseUrl: string, tokenId: string) {
  return `You are operating Loxley #${tokenId}, an owner-controlled on-chain agent on Robinhood Chain. Read ${baseUrl}/agents/info/${tokenId} for its identity and live state, ${baseUrl}/agents/${tokenId}/alliances for its social graph, and ${baseUrl}/agents/${tokenId}/trading for its MCP configuration. Discover the complete public API at ${baseUrl}/llms.txt and ${baseUrl}/openapi.json. Never claim an on-chain action succeeded until its transaction is confirmed.`;
}

function identityDocument(tokenId: string, publicImage: string, outlawImage: string, sealed: boolean, activeIdentity: 'public' | 'outlaw'): string {
  const initial = sealed ? activeIdentity : 'public';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Loxley #${tokenId} Identity</title><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#0a0a0a;color:#f4f4f0;font-family:Arial,sans-serif}main{min-height:100vh;display:grid;place-items:center;padding:20px}.frame{width:min(92vw,720px)}img{display:block;width:100%;aspect-ratio:1;image-rendering:pixelated;border:2px solid #cdff00;background:#0a0a0a}.switch{display:grid;grid-template-columns:1fr 1fr;margin-top:12px;border:2px solid #cdff00}.switch button{min-height:46px;border:0;border-right:2px solid #cdff00;background:#0a0a0a;color:#cdff00;font-weight:800;cursor:pointer}.switch button:last-child{border-right:0}.switch button[aria-pressed="true"]{background:#cdff00;color:#0a0a0a}.switch button:disabled{opacity:.45;cursor:not-allowed}</style></head><body><main><div class="frame"><img id="portrait" alt="Loxley #${tokenId} identity"><div class="switch"><button id="public" type="button">Public</button><button id="outlaw" type="button" ${sealed ? '' : 'disabled'}>Outlaw</button></div></div></main><script>const images={public:${JSON.stringify(publicImage)},outlaw:${JSON.stringify(outlawImage)}};const portrait=document.getElementById('portrait');const buttons=[document.getElementById('public'),document.getElementById('outlaw')];function show(mode){portrait.src=images[mode];buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.id===mode)))}buttons.forEach(button=>button.addEventListener('click',()=>show(button.id)));show('${initial}');</script></body></html>`;
}
