import { Check, Copy, Fingerprint, Link2, RefreshCw, Send, Unlink } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { adapter8004Abi, extensionsAbi, loxleysArtAbi, loxleysCanvasAbi } from '../abis';
import { Field, Metric, PageShell, formatBigInt, shortAddress } from '../components/ui';
import { TokenSelector } from '../components/TokenSelector';
import { useOwnedTokens } from '../hooks/useOwnedTokens';
import { contracts, publicApiBaseUrl } from '../web3/contracts';

type BindingResponse = {
  status: 'adapter_not_configured' | 'not_registered' | 'registered';
  binding: null | { agentId: string; agentUri: string | null; registeredBy: string; txHash: string };
};

type ReadinessResponse = {
  status: 'ready' | 'pending' | 'blocked';
  agentUri: string;
  agentCardUrl: string;
  identityUrl: string;
  expectedRegistration: null | { standard: number; registry: string; agentUri: string };
  capabilities: Array<{ id: string; name: string; source: 'traits'; trait: string }>;
  checks: Array<{ name: string; status: 'pass' | 'warn' | 'fail'; detail: string }>;
};

type AllianceResponse = {
  tokenId: string;
  count: number;
  allies: string[];
  incomingRequests: string[];
  outgoingRequests: string[];
};

const artContract = { address: contracts.loxleysArt, abi: loxleysArtAbi } as const;
const canvasContract = { address: contracts.loxleysCanvas, abi: loxleysCanvasAbi } as const;
const extensionContract = { address: contracts.agentExtensions, abi: extensionsAbi } as const;

export function AgentPage() {
  const [searchParams] = useSearchParams();
  const { ownedTokens, isConnected, address, refetch: refetchOwned, isFetching: ownedFetching } = useOwnedTokens();
  const [agentId, setAgentId] = useState(() => searchParams.get('agent') || '1');
  const [memory, setMemory] = useState('');
  const [allyId, setAllyId] = useState('2');
  const [binding, setBinding] = useState<BindingResponse | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [alliances, setAlliances] = useState<AllianceResponse | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [bindingError, setBindingError] = useState('');
  const tokenId = useMemo(() => BigInt(Math.max(1, Number(agentId) || 1)), [agentId]);
  const agentUri = `${publicApiBaseUrl}/agents/metadata/${tokenId}`;

  useEffect(() => {
    if (ownedTokens.length > 0 && agentId === '1' && !searchParams.get('agent')) {
      setAgentId(ownedTokens[0].toString());
    }
  }, [ownedTokens]);

  const { data: reads, refetch } = useReadContracts({
    contracts: [
      { ...artContract, functionName: 'ownerOf', args: [tokenId] },
      { ...artContract, functionName: 'personaOf', args: [tokenId] },
      { ...extensionContract, functionName: 'MAX_MEMORIES' },
      { ...extensionContract, functionName: 'MAX_ENTRY_LEN' },
      { ...extensionContract, functionName: 'memoryCount', args: [tokenId] },
      { ...extensionContract, functionName: 'alliesOf', args: [tokenId] },
      { ...canvasContract, functionName: 'delegateOf', args: [tokenId] },
      { ...canvasContract, functionName: 'isSealed', args: [tokenId] },
      { ...canvasContract, functionName: 'isOutlawActive', args: [tokenId] },
      { ...canvasContract, functionName: 'alteredPixels', args: [tokenId] },
    ],
    allowFailure: true,
  });

  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const busy = isPending || receipt.isLoading;
  const memoryIsValid = /^[\x20-\x7e]{1,96}$/.test(memory);

  async function refreshBinding() {
    setBindingError('');
    try {
      const [bindingResponse, readinessResponse, allianceResponse] = await Promise.all([
        fetch(`${publicApiBaseUrl}/agents/binding/${tokenId}`),
        fetch(`${publicApiBaseUrl}/agents/readiness/${tokenId}`),
        fetch(`${publicApiBaseUrl}/agents/${tokenId}/alliances`),
      ]);
      if (!bindingResponse.ok) throw new Error(`Binding API ${bindingResponse.status}`);
      if (!readinessResponse.ok) throw new Error(`Readiness API ${readinessResponse.status}`);
      if (!allianceResponse.ok) throw new Error(`Alliance API ${allianceResponse.status}`);
      setBinding(await bindingResponse.json() as BindingResponse);
      setReadiness(await readinessResponse.json() as ReadinessResponse);
      setAlliances(await allianceResponse.json() as AllianceResponse);
    } catch (cause) {
      setBinding(null);
      setReadiness(null);
      setAlliances(null);
      setBindingError(cause instanceof Error ? cause.message : 'Agent API unavailable');
    }
  }

  useEffect(() => { void refreshBinding(); }, [tokenId]);
  useEffect(() => {
    if (!receipt.isSuccess) return;
    void refetch();
    void refreshBinding();
  }, [receipt.isSuccess]);

  function refresh() {
    void refetch();
    void refreshBinding();
  }

  function registerAgent() {
    if (!contracts.adapter8004) return;
    writeContract({ address: contracts.adapter8004, abi: adapter8004Abi, functionName: 'register', args: [0, contracts.loxleysArt, tokenId, agentUri] });
  }

  function remember(event: FormEvent) {
    event.preventDefault();
    if (!memory.trim()) return;
    writeContract({ ...extensionContract, functionName: 'remember', args: [tokenId, memory.trim()] });
  }

  function requestAlliance(event: FormEvent) {
    event.preventDefault();
    writeContract({ ...extensionContract, functionName: 'requestAlliance', args: [tokenId, BigInt(Math.max(1, Number(allyId) || 1))] });
  }

  function acceptAlliance(fromAgent: string) {
    writeContract({ ...extensionContract, functionName: 'acceptAlliance', args: [tokenId, BigInt(fromAgent)] });
  }

  function breakAlliance(other: string) {
    writeContract({ ...extensionContract, functionName: 'breakAlliance', args: [tokenId, BigInt(other)] });
  }

  async function copyPrompt() {
    const response = await fetch(`${publicApiBaseUrl}/agents/${tokenId}/prompt.txt`);
    if (!response.ok) return;
    await navigator.clipboard.writeText(await response.text());
    setPromptCopied(true);
    window.setTimeout(() => setPromptCopied(false), 1800);
  }

  const owner = reads?.[0]?.result as string | undefined;
  const persona = reads?.[1]?.result as string | undefined;
  const sealed = reads?.[7]?.result === true;
  const outlawActive = reads?.[8]?.result === true;
  const alteredPixels = Number(reads?.[9]?.result ?? 0);
  const adapterStatus = contracts.adapter8004 ? (binding?.status || 'checking') : 'adapter_not_configured';
  const isOwner = Boolean(owner && address && owner.toLowerCase() === address.toLowerCase());

  return (
    <PageShell kicker="Agent / Adapter8004" title="On-chain agent control">
        <section className="agent-guide" aria-label="Agent workflow">
          {[
            ['01', 'Select', 'Choose a Loxley owned by the connected wallet.'],
            ['02', 'Inspect', 'Review its controller, identity, capabilities and readiness.'],
            ['03', 'Remember', 'Append permanent, public context to the NFT.'],
            ['04', 'Ally', 'Request, accept or end a mutual on-chain alliance.'],
          ].map(([step, title, text]) => (
            <div className="agent-guide-step" key={step}><span>{step}</span><strong>{title}</strong><p>{text}</p></div>
          ))}
        </section>

        <section className="agent-concepts" aria-label="Agent concepts">
          <p><strong>Public / Outlaw</strong> chooses the portrait shown in metadata; the original Public portrait is never destroyed.</p>
          <p><strong>Memory</strong> is append-only and public. It cannot be edited or deleted after confirmation.</p>
          <p><strong>Capability</strong> comes from NFT traits. Wallets cannot manually equip or transfer one.</p>
          <p><strong>Alliance</strong> requires two NFT owners. Either side can end it later.</p>
        </section>
        <TokenSelector
          ownedTokens={ownedTokens}
          selectedToken={agentId}
          onSelect={setAgentId}
          isFetching={ownedFetching}
          onRefresh={() => refetchOwned()}
          isConnected={isConnected}
        />

        <div className="agent-layout">
          <section className="terminal-box">
            <Field label="Agent token ID">
              <input value={agentId} onChange={(event) => setAgentId(event.target.value)} inputMode="numeric" />
            </Field>
            <Metric label="Owner / controller" value={shortAddress(owner)} />
            <Metric label="Adapter8004" value={adapterStatus.replaceAll('_', ' ')} />
            <Metric label="Agent ID" value={binding?.binding?.agentId || '...'} />
            <Metric label="Agent URI" value={binding?.binding?.agentUri || agentUri} />
            <Metric label="Canvas delegate" value={shortAddress(reads?.[6]?.result as string | undefined)} />
            <Metric label="Canvas state" value={sealed ? `${outlawActive ? 'Outlaw' : 'Public'} active · ${alteredPixels}/64 sealed` : 'Public identity'} />
            <Metric label="Memories" value={`${formatBigInt(reads?.[4]?.result)} / ${formatBigInt(reads?.[2]?.result)}`} />
            <Metric label="Entry max" value={`${formatBigInt(reads?.[3]?.result)} bytes`} />
            <Metric label="Capabilities" value={readiness ? `${readiness.capabilities.length} trait-derived` : '...'} />
            <Metric label="Allies" value={Array.isArray(reads?.[5]?.result) ? reads[5].result.length : '...'} />
            <Metric label="Wallet authority" value={isOwner ? <span className="ok-text">Owner — actions enabled</span> : <span className="warn-text">View only — connect the owner wallet</span>} />
            <button className="terminal-action" onClick={refresh}>
              <RefreshCw size={16} /> Refresh agent state
            </button>
          </section>

          <section className="form-stack">
            <section className="form-box adapter-register-box">
              <h2>Adapter8004 binding</h2>
              <p className="form-help">Creates a portable external identity record for this NFT. It does not transfer ownership or change its artwork.</p>
              <p className="agent-uri">{agentUri}</p>
              <button className="shadow-button" type="button" onClick={registerAgent} disabled={busy || !contracts.adapter8004 || binding?.status === 'registered'}>
                <Send size={16} />
                {!contracts.adapter8004 ? 'Adapter pending' : binding?.status === 'registered' ? 'Agent registered' : 'Register agent'}
              </button>
              {bindingError && <p className="form-error">Indexer: {bindingError}</p>}
            </section>

            <section className="persona-box readiness-box">
              <h2>Agent readiness</h2>
              <Metric
                label="Status"
                value={<span className={readinessStatusClass(readiness?.status)}>{readiness?.status || 'checking'}</span>}
              />
              <Metric label="A2A card" value={readiness?.agentCardUrl || `${publicApiBaseUrl}/agents/agent-card/${tokenId}`} />
              {readiness?.capabilities.map((capability) => (
                <Metric
                  key={capability.id}
                  label={capability.name}
                  value={<span className="ok-text">{capability.trait}</span>}
                />
              ))}
              {readiness?.checks.map((check) => (
                <Metric
                  key={check.name}
                  label={check.name.replaceAll('_', ' ')}
                  value={<span className={checkStatusClass(check.status)}>{check.detail}</span>}
                />
              ))}
            </section>

            <section className="persona-box">
              <h2>NFT persona</h2>
              <p>{persona || 'Reading NFT-derived persona from the token traits...'}</p>
            </section>

            <form className="form-box" onSubmit={remember}>
              <h2>Append memory</h2>
              <p className="form-help"><strong>Permanent:</strong> stored on-chain, visible in metadata and limited to printable ASCII. Only the current NFT owner can append.</p>
              <Field label="Memory entry">
                <textarea value={memory} maxLength={96} onChange={(event) => setMemory(event.target.value)} />
              </Field>
              {!memoryIsValid && memory.length > 0 && <p className="form-error">Use 1-96 printable ASCII characters.</p>}
              <button className="shadow-button" disabled={busy || !memoryIsValid || !isOwner}><Fingerprint size={16} /> Remember</button>
            </form>

            <section className="alliance-workspace">
              <div className="alliance-heading"><div><p className="section-kicker">Social graph</p><h2>Alliances</h2></div><p>An alliance forms when the other owner accepts, or immediately when both agents have requested each other. A transfer invalidates the transferred agent's pending requests.</p></div>
              <form className="alliance-request" onSubmit={requestAlliance}>
                <Field label="Request agent token ID"><input value={allyId} onChange={(event) => setAllyId(event.target.value)} inputMode="numeric" /></Field>
                <button className="shadow-button" disabled={busy || !isOwner}><Link2 size={15} /> Send request</button>
              </form>
              <div className="alliance-columns">
                <AllianceList title="Active allies" empty="No active alliances." values={alliances?.allies || []} actionLabel="End" onAction={breakAlliance} icon="break" disabled={busy || !isOwner} />
                <AllianceList title="Incoming" empty="No requests to review." values={alliances?.incomingRequests || []} actionLabel="Accept" onAction={acceptAlliance} icon="accept" disabled={busy || !isOwner} />
                <AllianceList title="Outgoing" empty="No pending requests." values={alliances?.outgoingRequests || []} disabled />
              </div>
            </section>

            <section className="form-box llm-prompt-box">
              <h2>Use this agent with an LLM</h2>
              <p className="form-help">Copy a short, provider-neutral prompt. It points the model to live identity, alliance, trading, OpenAPI and MCP discovery routes.</p>
              <button className="ghost-button" type="button" onClick={() => void copyPrompt()}><Copy size={15} /> {promptCopied ? 'Prompt copied' : 'Copy agent prompt'}</button>
            </section>
            {hash && <p className="tx-note">Transaction: {hash.slice(0, 14)}...</p>}
            {receipt.isSuccess && <p className="ok-text">Transaction confirmed.</p>}
            {error && <p className="form-error">{error.message}</p>}
          </section>
        </div>
    </PageShell>
  );
}

function AllianceList({ title, empty, values, actionLabel, onAction, icon, disabled }: { title: string; empty: string; values: string[]; actionLabel?: string; onAction?: (value: string) => void; icon?: 'accept' | 'break'; disabled?: boolean }) {
  return <section className="alliance-list"><h3>{title}</h3>{values.length === 0 ? <p>{empty}</p> : values.map((value) => <div className="alliance-row" key={value}><span>Loxley #{value}</span>{actionLabel && onAction && <button type="button" disabled={disabled} onClick={() => onAction(value)}>{icon === 'accept' ? <Check size={14} /> : <Unlink size={14} />}{actionLabel}</button>}</div>)}</section>;
}

function readinessStatusClass(status: ReadinessResponse['status'] | undefined) {
  if (status === 'ready') return 'ok-text';
  if (status === 'blocked') return 'form-error';
  return 'warn-text';
}

function checkStatusClass(status: 'pass' | 'warn' | 'fail') {
  if (status === 'pass') return 'ok-text';
  if (status === 'fail') return 'form-error';
  return 'warn-text';
}
