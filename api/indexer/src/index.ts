import { ponder } from 'ponder:registry';
import { agentBinding, alliance, allianceRequest, canvasState, collectionState, memory, tokenOwner } from 'ponder:schema';

const ZERO = '0x0000000000000000000000000000000000000000';
const ZERO_HASH = `0x${'00'.repeat(32)}` as const;
const pair = (a: bigint, b: bigint) => a < b ? `${a}:${b}` : `${b}:${a}`;

ponder.on('LoxleysArt:Transfer', async ({ event, context }) => {
  const { tokenId, to } = event.args;
  if (to.toLowerCase() === ZERO) await context.db.delete(tokenOwner, { tokenId });
  else await context.db.insert(tokenOwner).values({ tokenId, owner: to }).onConflictDoUpdate({ owner: to });
  const existingCanvas = await context.db.find(canvasState, { tokenId });
  if (existingCanvas) await context.db.update(canvasState, { tokenId }).set({ delegate: ZERO });
});

ponder.on('LoxleysArt:MintClosed', async ({ event, context }) => {
  const existing = await context.db.find(collectionState, { id: 'loxleys' });
  const values = { id: 'loxleys', mintClosed: true, finalMintedSupply: event.args.finalMintedSupply,
    revealed: existing?.revealed ?? false, startIndex: existing?.startIndex ?? null,
    blockNumber: event.block.number, txHash: event.transaction.hash };
  await context.db.insert(collectionState).values(values).onConflictDoUpdate(values);
});

ponder.on('LoxleysArt:StartIndexRevealed', async ({ event, context }) => {
  const existing = await context.db.find(collectionState, { id: 'loxleys' });
  const values = { id: 'loxleys', mintClosed: existing?.mintClosed ?? true,
    finalMintedSupply: existing?.finalMintedSupply ?? null, revealed: true, startIndex: event.args.startIndex,
    blockNumber: event.block.number, txHash: event.transaction.hash };
  await context.db.insert(collectionState).values(values).onConflictDoUpdate(values);
});

ponder.on('LoxleysCanvas:DelegateSet', async ({ event, context }) => {
  const existing = await context.db.find(canvasState, { tokenId: event.args.tokenId });
  const values = { tokenId: event.args.tokenId, delegate: event.args.delegate, customized: existing?.customized ?? false, sealed: existing?.sealed ?? false, activeIdentity: existing?.activeIdentity ?? 'public', alteredPixels: existing?.alteredPixels ?? 0, ownerAtSeal: existing?.ownerAtSeal ?? ZERO, sealedBy: existing?.sealedBy ?? ZERO, overlayHash: existing?.overlayHash ?? ZERO_HASH, blockNumber: event.block.number, txHash: event.transaction.hash };
  await context.db.insert(canvasState).values(values).onConflictDoUpdate(values);
});

ponder.on('LoxleysCanvas:OutlawSealed', async ({ event, context }) => {
  const existing = await context.db.find(canvasState, { tokenId: event.args.tokenId });
  const values = { tokenId: event.args.tokenId, delegate: existing?.delegate ?? ZERO, customized: true, sealed: true, activeIdentity: 'outlaw', alteredPixels: Number(event.args.alteredPixels), ownerAtSeal: event.args.owner, sealedBy: event.args.sealedBy, overlayHash: event.args.overlayHash, blockNumber: event.block.number, txHash: event.transaction.hash };
  await context.db.insert(canvasState).values(values).onConflictDoUpdate(values);
});

ponder.on('LoxleysCanvas:ActiveIdentitySet', async ({ event, context }) => {
  const existing = await context.db.find(canvasState, { tokenId: event.args.tokenId });
  const values = { tokenId: event.args.tokenId, delegate: existing?.delegate ?? ZERO, customized: existing?.customized ?? false, sealed: existing?.sealed ?? false, activeIdentity: event.args.outlawActive ? 'outlaw' : 'public', alteredPixels: existing?.alteredPixels ?? 0, ownerAtSeal: existing?.ownerAtSeal ?? ZERO, sealedBy: existing?.sealedBy ?? ZERO, overlayHash: existing?.overlayHash ?? ZERO_HASH, blockNumber: event.block.number, txHash: event.transaction.hash };
  await context.db.insert(canvasState).values(values).onConflictDoUpdate(values);
});

ponder.on('AgentExtensions:Remembered', async ({ event, context }) => {
  const { agentId, index, entry } = event.args;
  await context.db.insert(memory).values({ id: `${agentId}:${index}`, agentId, index, entry, blockNumber: event.block.number, txHash: event.transaction.hash }).onConflictDoNothing();
});

ponder.on('AgentExtensions:AllianceRequested', async ({ event, context }) => {
  const { fromAgent, toAgent } = event.args;
  await context.db.insert(allianceRequest).values({ id: `${fromAgent}:${toAgent}`, fromAgent, toAgent, pending: true }).onConflictDoUpdate({ pending: true });
});

ponder.on('AgentExtensions:AllianceFormed', async ({ event, context }) => {
  const { agentA, agentB } = event.args;
  await context.db.insert(alliance).values({ id: pair(agentA, agentB), agentA: agentA < agentB ? agentA : agentB, agentB: agentA < agentB ? agentB : agentA, active: true }).onConflictDoUpdate({ active: true });
  await context.db.insert(allianceRequest).values({ id: `${agentA}:${agentB}`, fromAgent: agentA, toAgent: agentB, pending: false }).onConflictDoUpdate({ pending: false });
  await context.db.insert(allianceRequest).values({ id: `${agentB}:${agentA}`, fromAgent: agentB, toAgent: agentA, pending: false }).onConflictDoUpdate({ pending: false });
});

ponder.on('AgentExtensions:AllianceBroken', async ({ event, context }) => {
  const id = pair(event.args.agentA, event.args.agentB);
  const existing = await context.db.find(alliance, { id });
  if (existing) await context.db.update(alliance, { id }).set({ active: false });
});

ponder.on('Adapter8004:AgentBound', async ({ event, context }) => {
  const { agentId, standard, tokenContract, tokenId, registeredBy } = event.args;
  const id = `${standard}:${tokenContract.toLowerCase()}:${tokenId}`;
  const publicBaseUrl = (process.env.PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  const agentUri = publicBaseUrl ? `${publicBaseUrl}/agents/metadata/${tokenId}` : null;
  await context.db.insert(agentBinding).values({ id, agentId, standard, tokenContract, tokenId, agentUri, registeredBy, blockNumber: event.block.number, txHash: event.transaction.hash }).onConflictDoUpdate({ agentId, agentUri, registeredBy, blockNumber: event.block.number, txHash: event.transaction.hash });
});
