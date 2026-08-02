import { Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { PageShell } from '../components/ui';
import { contracts, explorerBaseUrl, publicApiBaseUrl } from '../web3/contracts';

const contractRows = [
  ['LoxleysArt', contracts.loxleysArt, 'ERC-721 minting and fully on-chain token metadata'],
  ['LoxleysCanvas', contracts.loxleysCanvas, 'One-time Outlaw identity sealing'],
  ['AgentExtensions', contracts.agentExtensions, 'Memories and alliances'],
  ['Adapter8004', contracts.adapter8004 || '', 'Canonical external agent identity binding'],
];

const functionRows = [
  ['Mint', 'OpenSea SeaDrop -> ERC-721 ownership + immutable base bitmap'],
  ['Transform', 'sealOutlaw() -> permanent 1-256 pixel overlay after reveal'],
  ['Choose', 'setActiveIdentity() -> Public or Outlaw metadata'],
  ['Extend', 'remember(), requestAlliance()'],
  ['Register', 'Adapter8004.register(0, art, tokenId, agentURI)'],
];

const systemSections = [
  {
    title: 'On-chain art',
    text: 'LoxleysArt stores 2,000 generated 40x40 monochrome portraits as compact 200-byte bitmaps. Ten named rare portraits share the same normal mint pool as every other token. tokenURI renders self-contained on-chain metadata and SVG without an external image host.',
  },
  {
    title: 'Ownership and canvas',
    text: 'The ERC-721 owner is the default controller. Normal owners and delegates can seal one permanent Outlaw identity with up to 256 altered pixels. The immutable deployment artist can use all 1,600 pixels, but only while owning that NFT or holding its current owner’s explicit delegation. Transfers invalidate old delegate grants.',
  },
  {
    title: 'Agent life',
    text: 'AgentExtensions adds bounded memories and consent-based alliances. Capabilities are read-only runtime skills derived from immutable NFT traits, so no wallet can assign or equip them.',
  },
  {
    title: 'Identity and discovery',
    text: 'Adapter8004 is the canonical external identity binding. Until its Robinhood mainnet deployment is configured, tokens remain fully usable while registration reports adapter_not_configured. The Hono API publishes metadata, A2A cards, state projections, and an OpenAPI document.',
  },
];

export function DocsPage() {
  const [copied, setCopied] = useState(false);
  async function copyPrompt() {
    const response = await fetch(`${publicApiBaseUrl}/agents/1/prompt.txt`);
    if (!response.ok) return;
    await navigator.clipboard.writeText(await response.text());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return (
    <PageShell kicker="Docs" title="Loxleys protocol">
        <div className="docs-intro">
          <p>Loxleys combines immutable generated art, controlled pixel evolution, and portable agent identity on Robinhood Chain mainnet.</p>
          <div className="docs-flow" aria-label="Protocol flow">
            {functionRows.map(([label, value], index) => (
              <div className="docs-flow-step" key={label}><span>0{index + 1}</span><strong>{label}</strong><code>{value}</code></div>
            ))}
          </div>
        </div>

        <div className="docs-sections">
          {systemSections.map((section) => (
            <section className="docs-section" key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.text}</p>
            </section>
          ))}
        </div>

        <section className="docs-api-guide">
          <div className="docs-section-heading"><p className="section-kicker">Public API</p><h2>Give any LLM one prompt</h2></div>
          <p>The prompt points a model to live identity, social state, OpenAPI, <code>llms.txt</code> and MCP configuration without coupling it to one provider.</p>
          <pre>{`GET ${publicApiBaseUrl}/agents/1/prompt.txt\nGET ${publicApiBaseUrl}/openapi.json\nGET ${publicApiBaseUrl}/llms.txt`}</pre>
          <button className="ghost-button" type="button" onClick={() => void copyPrompt()}><Copy size={15} /> {copied ? 'Prompt copied' : 'Copy example prompt'}</button>
        </section>

        <section className="docs-alliance-guide">
          <div className="docs-section-heading"><p className="section-kicker">Alliance lifecycle</p><h2>Mutual, owner-controlled relationships</h2></div>
          <div className="docs-flow alliance-docs-flow">
            {[
              ['01', 'Request', 'The current owner of Agent A requests Agent B.'],
              ['02', 'Confirm', 'B accepts, or a matching B → A request forms it automatically.'],
              ['03', 'Publish', 'Both NFTs expose the active alliance in API and metadata.'],
              ['04', 'End', 'Either current owner may break it. A transfer invalidates stale requests.'],
            ].map(([step, title, text]) => <div className="docs-flow-step" key={step}><span>{step}</span><strong>{title}</strong><code>{text}</code></div>)}
          </div>
        </section>

        <section className="docs-contracts">
          <div className="docs-section-heading">
            <p className="section-kicker">Mainnet deployment</p>
            <h2>Contracts</h2>
          </div>
          <div className="contract-table">
            {contractRows.map(([label, address, description]) => address ? (
              <a
                href={`${explorerBaseUrl}/address/${address}`}
                target="_blank"
                rel="noreferrer"
                className="contract-row tall"
                key={label}
              >
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
                <code>{address}</code>
                <ExternalLink size={16} />
              </a>
            ) : (
              <div className="contract-row tall" key={label}>
                <span><strong>{label}</strong><small>{description}</small></span>
                <code>pending external deployment</code>
              </div>
            ))}
          </div>
        </section>
    </PageShell>
  );
}
