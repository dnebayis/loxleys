import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { ApiConfig } from './config.js';
import type { AgentBinding, AgentRepository, AgentState } from './repository.js';

const address = '0x1111111111111111111111111111111111111111' as const;
const binding: AgentBinding = { agentId: '8004', standard: 0, tokenContract: address, tokenId: '1', agentUri: 'https://api.example/agents/metadata/1', registeredBy: address, txHash: '0x1234' };
const state: AgentState = {
  tokenId: '1',
  owner: address,
  controller: address,
  persona: 'A persistent agent',
  traits: { type: 'Human Scout', gender: 'Masculine', age: 'Young', hair: 'Hooded', facialFeature: 'War Paint', eyes: 'Sharp Piercing', expression: 'Calm', accessory: 'Hood' },
  tokenUri: 'data:application/json;base64,e30=',
  image: 'data:image/svg+xml;base64,PHN2Zy8+',
  memories: ['remember'],
  capabilities: [{ id: 'archetype:human-scout', name: 'Human Scout Protocol', manifestUri: 'loxleys://capability/archetype:human-scout', source: 'traits', trait: 'Derived from Type: Human Scout' }],
  allies: ['2'],
  canvas: { delegate: address, customized: true, sealed: true, activeIdentity: 'public', alteredPixels: 12, overlayHash: '0x1234', publicImage: 'data:image/svg+xml;base64,UHVibGlj', outlawImage: 'data:image/svg+xml;base64,T3V0bGF3' },
};

class FakeRepository implements AgentRepository {
  constructor(private readonly value: AgentBinding | null) {}
  getBinding() { return Promise.resolve(this.value); }
  getBindingByAgentId() { return Promise.resolve(this.value); }
  listBindings() { return Promise.resolve(this.value ? [this.value] : []); }
  getTokensByOwner() { return Promise.resolve(['1']); }
  getAllianceState() { return Promise.resolve({ allies: ['2'], incomingRequests: ['3'], outgoingRequests: ['4'] }); }
  getState() { return Promise.resolve(state); }
}

const base: ApiConfig = { publicApiBaseUrl: 'https://api.example', rpcUrl: '', ponderGraphqlUrl: '', artAddress: address, canvasAddress: address, extensionsAddress: address };

describe('agent API', () => {
  it('reports adapter_not_configured explicitly', async () => {
    const response = await createApp(base, new FakeRepository(null)).request('/agents/binding/1');
    expect(await response.json()).toEqual({ status: 'adapter_not_configured', binding: null });
  });

  it('reports an unregistered token', async () => {
    const response = await createApp({ ...base, adapterAddress: address }, new FakeRepository(null)).request('/agents/binding/1');
    expect(await response.json()).toEqual({ status: 'not_registered', binding: null });
  });

  it('returns binding, metadata and A2A skill data', async () => {
    const app = createApp({ ...base, adapterAddress: address }, new FakeRepository(binding));
    expect((await (await app.request('/agents/binding/1')).json()).status).toBe('registered');
    const metadata = await (await app.request('/agents/metadata/1')).json();
    expect(metadata.services[0].endpoint).toBe('https://api.example/agents/agent-card/1');
    const card = await (await app.request('/agents/agent-card/1')).json();
    expect(card.skills[0].name).toBe('Human Scout Protocol');
    expect(card.skills[0].tags).toContain('traits');
  });

  it('publishes discovery and OpenAPI documents', async () => {
    const app = createApp(base, new FakeRepository(null));
    const root = await (await app.request('/')).json();
    expect(root.version).toBe('3.0.0');
    const manifest = await (await app.request('/.well-known/agent.json')).json();
    expect(manifest.metadataTemplate).toContain('/agents/metadata/{tokenId}');
    const openapi = await (await app.request('/openapi.json')).json();
    expect(openapi.openapi).toBe('3.1.0');
    expect(openapi.paths['/agents/readiness/{tokenId}']).toBeDefined();
    expect(openapi.paths['/agents/{tokenId}/canvas']).toBeDefined();
  });

  it('returns focused agent state projections', async () => {
    const app = createApp(base, new FakeRepository(null));
    expect(await (await app.request('/agents/1/memories')).json()).toEqual({ tokenId: '1', count: 1, memories: ['remember'] });
    const capabilities = await (await app.request('/agents/1/capabilities')).json();
    expect(capabilities.source).toBe('traits');
    expect(capabilities.capabilities[0].name).toBe('Human Scout Protocol');
    expect(await (await app.request('/agents/1/alliances')).json()).toEqual({ tokenId: '1', count: 1, allies: ['2'], incomingRequests: ['3'], outgoingRequests: ['4'] });
    const canvas = await (await app.request('/agents/1/canvas')).json();
    expect(canvas.canvas.customized).toBe(true);
    expect(canvas.canvas.alteredPixels).toBe(12);
    expect(canvas.canvas.activeIdentity).toBe('public');
    const embed = await app.request('/tokens/1/identity');
    expect(embed.headers.get('content-type')).toContain('text/html');
    expect(await embed.text()).toContain('Outlaw');
    expect(await (await app.request('/tokens/1/identity')).text()).toContain("show('public')");
  });

  it('publishes a short LLM prompt and alliance request schema', async () => {
    const app = createApp(base, new FakeRepository(null));
    const prompt = await app.request('/agents/1/prompt.txt');
    expect(prompt.headers.get('content-type')).toContain('text/plain');
    expect(await prompt.text()).toContain('/agents/1/alliances');
    const openapi = await (await app.request('/openapi.json')).json();
    expect(openapi.paths['/agents/{tokenId}/prompt.txt']).toBeDefined();
    expect(openapi.paths['/mcp'].post).toBeDefined();
  });

  it('returns agent production readiness', async () => {
    const app = createApp({ ...base, adapterAddress: address }, new FakeRepository(binding));
    const readiness = await (await app.request('/agents/readiness/1')).json();
    expect(readiness.status).toBe('pending');
    expect(readiness.agentUri).toBe('https://api.example/agents/metadata/1');
    expect(readiness.expectedRegistration).toEqual({ standard: 0, registry: address, agentUri: 'https://api.example/agents/metadata/1' });
    expect(readiness.capabilities[0].source).toBe('traits');
    expect(readiness.checks.find((check: { name: string }) => check.name === 'binding').status).toBe('pass');
    expect(readiness.checks.find((check: { name: string }) => check.name === 'opensea_identity_embed').status).toBe('warn');
  });

  it('rejects invalid IDs on projection routes', async () => {
    const app = createApp(base, new FakeRepository(null));
    const response = await app.request('/agents/nope/canvas');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_token_id' });
    expect((await app.request('/mcp/config/2001')).status).toBe(400);
  });

  it('lists tokens by owner', async () => {
    const response = await createApp(base, new FakeRepository(null)).request(`/agents/by-owner/${address}`);
    expect(await response.json()).toEqual({ owner: address, tokenIds: ['1'] });
  });

  it('rejects unsafe MCP inputs before proxying', async () => {
    const app = createApp(base, new FakeRepository(null));
    const portfolio = await app.request('/mcp?rh_token=must-not-be-read', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_portfolio', arguments: {} } }),
    });
    expect(JSON.stringify(await portfolio.json())).toContain('auth token required');

    const order = await app.request('/mcp', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'place_order', arguments: { tokenId: '1', symbol: 'AAPL', side: 'buy', quantity: -1, type: 'market' } } }),
    });
    expect(JSON.stringify(await order.json())).toContain('positive number');

    const memory = await app.request('/mcp', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'log_trade_memory', arguments: { tokenId: '1', entry: 'BUY:İST:1:1sh' } } }),
    });
    expect(JSON.stringify(await memory.json())).toContain('printable ASCII');
  });
});
