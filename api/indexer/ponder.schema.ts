import { index, onchainTable } from 'ponder';

export const tokenOwner = onchainTable('token_owner', (t) => ({
  tokenId: t.bigint().primaryKey(), owner: t.hex().notNull(),
}), (table) => ({ ownerIdx: index().on(table.owner) }));

export const collectionState = onchainTable('collection_state', (t) => ({
  id: t.text().primaryKey(), mintClosed: t.boolean().notNull().default(false),
  finalMintedSupply: t.bigint(), revealed: t.boolean().notNull().default(false), startIndex: t.bigint(),
  blockNumber: t.bigint().notNull(), txHash: t.hex().notNull(),
}));

export const canvasState = onchainTable('canvas_state', (t) => ({
  tokenId: t.bigint().primaryKey(), delegate: t.hex().notNull(), customized: t.boolean().notNull().default(false),
  sealed: t.boolean().notNull().default(false), alteredPixels: t.integer().notNull().default(0),
  activeIdentity: t.text().notNull().default('public'),
  ownerAtSeal: t.hex().notNull(), sealedBy: t.hex().notNull(), overlayHash: t.hex().notNull(),
  blockNumber: t.bigint().notNull(), txHash: t.hex().notNull(),
}));

export const memory = onchainTable('memory', (t) => ({
  id: t.text().primaryKey(), agentId: t.bigint().notNull(), index: t.bigint().notNull(), entry: t.text().notNull(),
  blockNumber: t.bigint().notNull(), txHash: t.hex().notNull(),
}), (table) => ({ agentIdx: index().on(table.agentId, table.index) }));

export const allianceRequest = onchainTable('alliance_request', (t) => ({
  id: t.text().primaryKey(), fromAgent: t.bigint().notNull(), toAgent: t.bigint().notNull(), pending: t.boolean().notNull(),
}));

export const alliance = onchainTable('alliance', (t) => ({
  id: t.text().primaryKey(), agentA: t.bigint().notNull(), agentB: t.bigint().notNull(), active: t.boolean().notNull(),
}), (table) => ({ agentAIdx: index().on(table.agentA), agentBIdx: index().on(table.agentB) }));

export const agentBinding = onchainTable('agent_binding', (t) => ({
  id: t.text().primaryKey(), agentId: t.bigint().notNull(), standard: t.integer().notNull(), tokenContract: t.hex().notNull(),
  tokenId: t.bigint().notNull(), agentUri: t.text(), registeredBy: t.hex().notNull(), blockNumber: t.bigint().notNull(), txHash: t.hex().notNull(),
}), (table) => ({ agentIdIdx: index().on(table.agentId), tokenIdx: index().on(table.standard, table.tokenContract, table.tokenId) }));
