import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import { robinhoodChain } from './robinhood.js';
import { artAbi, canvasAbi, extensionsAbi } from './abis.js';
import type { ApiConfig } from './config.js';

export type AgentBinding = {
  agentId: string;
  standard: number;
  tokenContract: Address;
  tokenId: string;
  agentUri: string | null;
  registeredBy: Address;
  txHash: `0x${string}`;
};

export type AgentState = {
  tokenId: string;
  owner: Address;
  controller: Address;
  persona: string;
  traits: AgentTraits;
  tokenUri: string;
  image: string;
  memories: string[];
  capabilities: DerivedCapability[];
  allies: string[];
  canvas: {
    delegate: Address;
    customized: boolean;
    sealed: boolean;
    activeIdentity: 'public' | 'outlaw';
    alteredPixels: number;
    overlayHash: `0x${string}`;
    publicImage: string;
    outlawImage: string;
  };
};

export type AgentTraits = {
  type: string;
  gender: string;
  age: string;
  hair: string;
  facialFeature: string;
  eyes: string;
  expression: string;
  accessory: string;
};

export type DerivedCapability = {
  id: string;
  name: string;
  manifestUri: string;
  source: 'traits';
  trait: string;
};

export type AllianceState = {
  allies: string[];
  incomingRequests: string[];
  outgoingRequests: string[];
};

export interface AgentRepository {
  getBinding(tokenId: bigint): Promise<AgentBinding | null>;
  getBindingByAgentId(agentId: bigint): Promise<AgentBinding | null>;
  listBindings(limit: number): Promise<AgentBinding[]>;
  getState(tokenId: bigint): Promise<AgentState>;
  getTokensByOwner(owner: Address): Promise<string[]>;
  getAllianceState(tokenId: bigint): Promise<AllianceState>;
}

type GraphResponse<T> = { data?: T; errors?: Array<{ message: string }> };

export class LiveAgentRepository implements AgentRepository {
  private readonly client: PublicClient;

  constructor(private readonly config: ApiConfig) {
    this.client = createPublicClient({ chain: robinhoodChain, transport: http(config.rpcUrl) });
  }

  private async query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.config.ponderGraphqlUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`Indexer unavailable (${response.status})`);
    const payload = (await response.json()) as GraphResponse<T>;
    if (payload.errors?.length || !payload.data) throw new Error(payload.errors?.[0]?.message || 'Invalid indexer response');
    return payload.data;
  }

  async getBinding(tokenId: bigint): Promise<AgentBinding | null> {
    if (!this.config.adapterAddress || !this.config.artAddress) return null;
    const id = `0:${this.config.artAddress.toLowerCase()}:${tokenId}`;
    const data = await this.query<{ agentBinding: AgentBinding | null }>(
      `query Binding($id: String!) { agentBinding(id: $id) { agentId standard tokenContract tokenId agentUri registeredBy txHash } }`,
      { id },
    );
    return data.agentBinding;
  }

  async getBindingByAgentId(agentId: bigint): Promise<AgentBinding | null> {
    const data = await this.query<{ agentBindings: { items: AgentBinding[] } }>(
      `query ByAgentId($agentId: BigInt!) { agentBindings(where: { agentId: $agentId }, limit: 1) { items { agentId standard tokenContract tokenId agentUri registeredBy txHash } } }`,
      { agentId: agentId.toString() },
    );
    return data.agentBindings.items[0] || null;
  }

  async listBindings(limit: number): Promise<AgentBinding[]> {
    const data = await this.query<{ agentBindings: { items: AgentBinding[] } }>(
      `query Bindings($limit: Int!) { agentBindings(limit: $limit, orderBy: "tokenId", orderDirection: "asc") { items { agentId standard tokenContract tokenId agentUri registeredBy txHash } } }`,
      { limit },
    );
    return data.agentBindings.items;
  }

  async getTokensByOwner(owner: Address): Promise<string[]> {
    const data = await this.query<{ tokenOwners: { items: Array<{ tokenId: string }> } }>(
      `query ByOwner($owner: String!) { tokenOwners(where: { owner: $owner }, limit: 100, orderBy: "tokenId", orderDirection: "asc") { items { tokenId } } }`,
      { owner: owner.toLowerCase() },
    );
    return data.tokenOwners.items.map((t) => t.tokenId);
  }

  async getAllianceState(tokenId: bigint): Promise<AllianceState> {
    if (!this.config.extensionsAddress) throw new Error('extensions_not_configured');
    const [allies, incomingData, outgoingData] = await Promise.all([
      this.client.readContract({ address: this.config.extensionsAddress, abi: extensionsAbi, functionName: 'alliesOf', args: [tokenId] }),
      this.query<{ allianceRequests: { items: Array<{ fromAgent: string; toAgent: string }> } }>(
        `query Incoming($tokenId: BigInt!) { allianceRequests(where: { toAgent: $tokenId, pending: true }, limit: 100) { items { fromAgent toAgent } } }`,
        { tokenId: tokenId.toString() },
      ),
      this.query<{ allianceRequests: { items: Array<{ fromAgent: string; toAgent: string }> } }>(
        `query Outgoing($tokenId: BigInt!) { allianceRequests(where: { fromAgent: $tokenId, pending: true }, limit: 100) { items { fromAgent toAgent } } }`,
        { tokenId: tokenId.toString() },
      ),
    ]);

    const incoming = await this._currentRequests(incomingData.allianceRequests.items);
    const outgoing = await this._currentRequests(outgoingData.allianceRequests.items);
    return {
      allies: allies.map(String),
      incomingRequests: incoming.map((request) => request.fromAgent),
      outgoingRequests: outgoing.map((request) => request.toAgent),
    };
  }

  private async _currentRequests(requests: Array<{ fromAgent: string; toAgent: string }>) {
    const checks = await Promise.all(requests.map(async (request) => ({
      request,
      current: await this.client.readContract({
        address: this.config.extensionsAddress!, abi: extensionsAbi,
        functionName: 'hasPendingRequest', args: [BigInt(request.fromAgent), BigInt(request.toAgent)],
      }),
    })));
    return checks.filter((item) => item.current).map((item) => item.request);
  }

  async getState(tokenId: bigint): Promise<AgentState> {
    const { artAddress, canvasAddress, extensionsAddress } = this.config;
    if (!artAddress || !canvasAddress || !extensionsAddress) throw new Error('contracts_not_configured');

    const [owner, persona, traitsRaw, tokenUri, delegate, sealed, outlawActive, alteredPixels, overlayHash, baseBitmap, outlawBitmap, memories, allies] = await Promise.all([
      this.client.readContract({ address: artAddress, abi: artAbi, functionName: 'ownerOf', args: [tokenId] }),
      this.client.readContract({ address: artAddress, abi: artAbi, functionName: 'personaOf', args: [tokenId] }),
      this.client.readContract({ address: artAddress, abi: artAbi, functionName: 'traitsOf', args: [tokenId] }),
      this.client.readContract({ address: artAddress, abi: artAbi, functionName: 'tokenURI', args: [tokenId] }),
      this.client.readContract({ address: canvasAddress, abi: canvasAbi, functionName: 'delegateOf', args: [tokenId] }),
      this.client.readContract({ address: canvasAddress, abi: canvasAbi, functionName: 'isSealed', args: [tokenId] }),
      this.client.readContract({ address: canvasAddress, abi: canvasAbi, functionName: 'isOutlawActive', args: [tokenId] }),
      this.client.readContract({ address: canvasAddress, abi: canvasAbi, functionName: 'alteredPixels', args: [tokenId] }),
      this.client.readContract({ address: canvasAddress, abi: canvasAbi, functionName: 'overlayHash', args: [tokenId] }),
      this.client.readContract({ address: artAddress, abi: artAbi, functionName: 'baseBitmap', args: [tokenId] }),
      this.client.readContract({ address: artAddress, abi: artAbi, functionName: 'outlawBitmap', args: [tokenId] }),
      this.client.readContract({ address: extensionsAddress, abi: extensionsAbi, functionName: 'memoriesOf', args: [tokenId] }),
      this.client.readContract({ address: extensionsAddress, abi: extensionsAbi, functionName: 'alliesOf', args: [tokenId] }),
    ]);
    const traits = decodeTraits(traitsRaw);
    const capabilities = deriveCapabilities(traits);
    return {
      tokenId: tokenId.toString(), owner, controller: owner, persona, traits, tokenUri,
      image: imageFromTokenUri(tokenUri),
      memories: [...memories], capabilities, allies: allies.map(String),
      canvas: {
        delegate,
        customized: sealed,
        sealed,
        activeIdentity: outlawActive ? 'outlaw' : 'public',
        alteredPixels: Number(alteredPixels),
        overlayHash,
        publicImage: bitmapImage(baseBitmap),
        outlawImage: bitmapImage(outlawBitmap),
      },
    };
  }
}

const traitLabels = {
  type: ['Human Scout', 'Human Rogue', 'Human Hacker', 'Human Ranger', 'Human Oracle', 'Human Phantom', 'Portrait Dog', 'Portrait Cat', 'Alien', 'Secret Agent'],
  gender: ['Masculine', 'Feminine', 'Androgynous'],
  age: ['Young', 'Adult', 'Elder'],
  hair: ['Bald', 'Buzzcut', 'Short', 'Messy', 'Spiky', 'Curly', 'Afro', 'Wavy', 'Long', 'Bowl Cut', 'Undercut', 'Slicked-Back', 'Mohawk', 'Dreadlocks', 'Cornrows', 'Ponytail', 'Top-Knot', 'Man-Bun', 'Bangs', 'Pigtails', 'Hooded', 'Receding', 'Shaved Sides'],
  facialFeature: ['Clean-Shaven', 'Stubble', 'Mustache', 'Goatee', 'Full Beard', 'Sideburns', 'Soul Patch', 'Scarred Cheek', 'Freckles', 'Face Tattoo', 'War Paint', 'Cybernetic Jaw', 'Nose Ring', 'Eye Scar', 'Beauty Mark', 'Wrinkles', 'Dimples', 'Cheek Markings', 'Chin Strap Beard'],
  eyes: ['Normal', 'Round Glasses', 'Square Glasses', 'Sunglasses', 'Cyber Visor', 'Glowing Cyber Eye', 'Eyepatch', 'Monocle', 'Closed', 'Winking', 'Wide', 'Narrow', 'Glowing', 'Heterochromia', 'Tired', 'Sharp Piercing', 'Big Round'],
  expression: ['Neutral', 'Smiling', 'Smirking', 'Frowning', 'Serious', 'Surprised', 'Grinning', 'Scowling', 'Calm'],
  accessory: ['None', 'Beanie', 'Cap', 'Hood', 'Helmet', 'Headphones', 'Headband', 'Bandana', 'Glowing Halo', 'Crown', 'Small Horns', 'Antenna', 'Earring', 'Neck Chain', 'Scarf', 'High Collar', 'Face Mask', 'Cigarette', 'Flower', 'Laurel Wreath'],
} as const;

function decodeTraits(raw: `0x${string}`): AgentTraits {
  const bytes = Buffer.from(raw.slice(2).padEnd(16, '0').slice(0, 16), 'hex');
  return {
    type: label(traitLabels.type, bytes[0]),
    gender: label(traitLabels.gender, bytes[1]),
    age: label(traitLabels.age, bytes[2]),
    hair: label(traitLabels.hair, bytes[3]),
    facialFeature: label(traitLabels.facialFeature, bytes[4]),
    eyes: label(traitLabels.eyes, bytes[5]),
    expression: label(traitLabels.expression, bytes[6]),
    accessory: label(traitLabels.accessory, bytes[7]),
  };
}

function label(values: readonly string[], index: number): string {
  return values[index] || values[values.length - 1] || 'Unknown';
}

function deriveCapabilities(traits: AgentTraits): DerivedCapability[] {
  return [
    capability(`archetype:${slug(traits.type)}`, `${traits.type} Protocol`, `Derived from Type: ${traits.type}`),
    capability(`perception:${slug(traits.eyes)}`, `${traits.eyes} Perception`, `Derived from Eyes: ${traits.eyes}`),
    capability(`presence:${slug(traits.accessory)}`, `${traits.accessory} Presence`, `Derived from Accessory: ${traits.accessory}`),
  ];
}

function capability(id: string, name: string, trait: string): DerivedCapability {
  return { id, name, manifestUri: `loxleys://capability/${id}`, source: 'traits', trait };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'none';
}

function bitmapImage(bitmap: `0x${string}`): string {
  const bytes = Buffer.from(bitmap.slice(2), 'hex');
  if (bytes.length !== 200) return '';
  let rects = '';
  for (let y = 0; y < 40; y += 1) {
    let x = 0;
    while (x < 40) {
      const index = y * 40 + x;
      const on = ((bytes[index >> 3] >> (7 - (index & 7))) & 1) === 1;
      if (!on) { x += 1; continue; }
      const start = x;
      while (x < 40) {
        const next = y * 40 + x;
        if (((bytes[next >> 3] >> (7 - (next & 7))) & 1) !== 1) break;
        x += 1;
      }
      rects += `<rect x="${start}" y="${y}" width="${x - start}" height="1"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" shape-rendering="crispEdges"><rect width="40" height="40" fill="#0A0A0A"/><g fill="#CDFF00">${rects}</g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function imageFromTokenUri(tokenUri: string): string {
  const prefix = 'data:application/json;base64,';
  if (!tokenUri.startsWith(prefix)) return tokenUri;
  try {
    const metadata = JSON.parse(Buffer.from(tokenUri.slice(prefix.length), 'base64').toString('utf8')) as { image?: string };
    return metadata.image || tokenUri;
  } catch {
    return tokenUri;
  }
}
