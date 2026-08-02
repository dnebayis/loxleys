import { ChevronDown, ClipboardCopy, ExternalLink, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageShell } from '../components/ui';
import { TokenSelector } from '../components/TokenSelector';
import { TokenThumb } from '../components/TokenThumb';
import { useOwnedTokens } from '../hooks/useOwnedTokens';
import { contracts, publicApiBaseUrl } from '../web3/contracts';

type TradingResponse = {
  tokenId: string;
  owner: string | null;
  persona: string | null;
  capabilities: Array<{ id: string; name: string; trait: string }>;
  tradingEnabled: boolean;
  robinhoodMcp: string;
  tradeMemories: string[];
  totalMemories: number;
  maxMemories: number;
};

export function TradingPage() {
  const { ownedTokens, isConnected, refetch: refetchOwners, isFetching } = useOwnedTokens();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [trading, setTrading] = useState<TradingResponse | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [copied, setCopied] = useState<'prompt' | 'config' | null>(null);

  useEffect(() => {
    if (ownedTokens.length > 0 && !selectedToken) setSelectedToken(ownedTokens[0].toString());
  }, [ownedTokens]);

  useEffect(() => {
    if (!selectedToken) { setTrading(null); return; }
    fetch(`${publicApiBaseUrl}/agents/${selectedToken}/trading`)
      .then((r) => r.ok ? r.json() as Promise<TradingResponse> : null)
      .catch(() => null)
      .then(setTrading);
  }, [selectedToken]);

  const agentPrompt = selectedToken
    ? `You are Loxley #${selectedToken}, an AI trading agent on Robinhood Chain.

Use the Robinhood agentic trading MCP to execute stock trades on my behalf.
My identity token is #${selectedToken} on contract ${contracts.loxleysArt}.
${trading?.persona ? `\nPersona: ${trading.persona}` : ''}
${trading?.capabilities?.length ? `Capabilities: ${trading.capabilities.map((c) => c.name).join(', ')}` : ''}

After each trade, log a compact memory entry (format: BUY:AAPL:150.25:10sh or SELL:TSLA:220.00:5sh) to my on-chain memory via the Loxleys MCP.`
    : '';

  const mcpConfig = selectedToken
    ? JSON.stringify({
        mcpServers: {
          loxleys: {
            command: 'npx',
            args: ['-y', 'mcp-remote', `${publicApiBaseUrl}/mcp`],
            env: { LOXLEY_TOKEN_ID: selectedToken },
          },
          robinhood: { url: 'https://agent.robinhood.com/mcp/trading' },
        },
      }, null, 2)
    : '';

  function copyText(text: string, label: 'prompt' | 'config') {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  if (!isConnected) {
    return (
      <PageShell kicker="Trading / Agentic" title="Robinhood agentic trading">
        <div className="t-empty">
          <p>Connect your wallet to see your Loxley agents and enable agentic trading.</p>
        </div>
      </PageShell>
    );
  }

  if (isFetching && ownedTokens.length === 0) {
    return (
      <PageShell kicker="Trading / Agentic" title="Robinhood agentic trading">
        <div className="t-empty"><p>Scanning on-chain ownership...</p></div>
      </PageShell>
    );
  }

  if (ownedTokens.length === 0) {
    return (
      <PageShell kicker="Trading / Agentic" title="Robinhood agentic trading">
        <div className="t-empty">
          <p>No Loxley agents found in your wallet.</p>
          <p className="t-empty-sub">Mint a Loxley first, then come back to set up agentic trading.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell kicker="Trading / Agentic" title="Robinhood agentic trading">
      <div className="t-page">

        <TokenSelector
          ownedTokens={ownedTokens}
          selectedToken={selectedToken || ''}
          onSelect={setSelectedToken}
          isFetching={isFetching}
          onRefresh={() => refetchOwners()}
          isConnected={isConnected}
        />

        {selectedToken && (
          <>
            {/* Profile bar */}
            <section className="t-profile">
              <TokenThumb tokenId={BigInt(selectedToken)} size={56} />
              <div className="t-profile-meta">
                <h2>Loxley #{selectedToken}</h2>
                {trading?.persona && <p className="t-persona">{trading.persona}</p>}
              </div>
              {trading?.capabilities && trading.capabilities.length > 0 && (
                <div className="t-caps">
                  {trading.capabilities.map((cap) => (
                    <span key={cap.id} className="t-cap">{cap.name}</span>
                  ))}
                </div>
              )}
            </section>

            {/* Agent prompt — the main CTA */}
            <section className="t-prompt-section">
              <div className="t-prompt-head">
                <h2>Agent prompt</h2>
                <span className="t-prompt-hint">Copy and paste into Claude, ChatGPT, Grok, or Cursor</span>
              </div>
              <div className="t-prompt-block">
                <pre className="t-prompt-pre">{agentPrompt}</pre>
                <button className="t-copy-btn" onClick={() => copyText(agentPrompt, 'prompt')}>
                  <ClipboardCopy size={13} /> {copied === 'prompt' ? 'Copied!' : 'Copy prompt'}
                </button>
              </div>
              <div className="t-clients">
                <span className="t-client">Claude Code</span>
                <span className="t-client">ChatGPT</span>
                <span className="t-client">Grok</span>
                <span className="t-client">Cursor</span>
              </div>
            </section>

            {/* Setup steps */}
            <section className="t-steps-section">
              <h2>How it works</h2>
              <ol className="t-steps">
                <li>
                  <strong>Open a Robinhood agentic account</strong>
                  <p>Sign up for a dedicated agentic trading account on Robinhood.</p>
                  <a href="https://robinhood.com/us/en/agentic-trading/" target="_blank" rel="noreferrer" className="t-link">
                    <ExternalLink size={12} /> robinhood.com/agentic-trading
                  </a>
                </li>
                <li>
                  <strong>Copy your agent prompt above</strong>
                  <p>Paste it into your AI client as a system prompt or opening message.</p>
                </li>
                <li>
                  <strong>Trade with on-chain identity</strong>
                  <p>Your AI agent trades via Robinhood MCP — trade decisions log to on-chain memory.</p>
                </li>
              </ol>
            </section>

            {/* Trade log */}
            <section className="t-log">
              <h2>Trade log</h2>
              {trading?.tradeMemories?.length ? (
                <div className="t-log-list">
                  {trading.tradeMemories.map((m, i) => <TradeRow key={i} entry={m} />)}
                </div>
              ) : (
                <p className="t-log-empty">No trades recorded on-chain yet.</p>
              )}
              <div className="t-log-cap">{trading?.totalMemories || 0} / {trading?.maxMemories || 32} memory slots</div>
            </section>

            {/* MCP config (collapsed by default, for power users) */}
            <section className="t-config">
              <button className="t-config-toggle" onClick={() => setConfigOpen(!configOpen)}>
                <Terminal size={13} />
                <span>MCP server config</span>
                <ChevronDown size={13} className={configOpen ? 't-chevron-open' : ''} />
              </button>
              {configOpen && (
                <div className="t-config-body">
                  <p className="t-config-hint">For advanced setup — add these MCP servers to your AI client config file:</p>
                  <div className="t-config-block">
                    <pre className="t-config-pre">{mcpConfig}</pre>
                    <button className="t-copy-btn t-copy-dark" onClick={() => copyText(mcpConfig, 'config')}>
                      <ClipboardCopy size={13} /> {copied === 'config' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
}

function TradeRow({ entry }: { entry: string }) {
  const [side = '', symbol = '', price = '', qty = ''] = entry.split(':');
  return (
    <div className={`t-trade ${side === 'BUY' ? 't-buy' : 't-sell'}`}>
      <span className="t-trade-side">{side}</span>
      <span className="t-trade-sym">{symbol}</span>
      <span className="t-trade-price">{price}</span>
      <span className="t-trade-qty">{qty}</span>
    </div>
  );
}
