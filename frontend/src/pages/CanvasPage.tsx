import {
  Download,
  Fingerprint,
  LockKeyhole,
  Redo2,
  RotateCcw,
  Undo2,
  Upload,
  UserRoundCog,
  UserRoundX,
  X,
} from 'lucide-react';
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { bytesToHex, getAddress, isAddress, keccak256, zeroAddress, type Address, type Hex } from 'viem';
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { loxleysArtAbi, loxleysCanvasAbi } from '../abis';
import { Field, Metric, PageShell, friendlyError, shortAddress } from '../components/ui';
import { TokenSelector } from '../components/TokenSelector';
import { useOwnedTokens } from '../hooks/useOwnedTokens';
import { contracts, explorerBaseUrl } from '../web3/contracts';

const PIXEL_COUNT = 1600;
const BYTE_COUNT = 200;
const artContract = { address: contracts.loxleysArt, abi: loxleysArtAbi } as const;
const canvasContract = { address: contracts.loxleysCanvas, abi: loxleysCanvasAbi } as const;

type IdentityMode = 'public' | 'outlaw';
type CanvasAction = 'delegate' | 'seal' | 'identity';
type DraftPayload = {
  version: 1;
  chainId: number;
  artContract: string;
  tokenId: string;
  overlay: Hex;
  alteredPixels: number;
  overlayHash: Hex;
};

export function CanvasPage() {
  const [searchParams] = useSearchParams();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { ownedTokens, refetch: refetchOwned, isFetching: ownedFetching } = useOwnedTokens();
  const [tokenInput, setTokenInput] = useState(() => searchParams.get('agent') || '1');
  const hasInitFromOwned = useRef(false);
  const [delegate, setDelegate] = useState('');
  const [mode, setMode] = useState<IdentityMode>('outlaw');
  const [draftPixels, setDraftPixels] = useState<boolean[]>([]);
  const [undoStack, setUndoStack] = useState<boolean[][]>([]);
  const [redoStack, setRedoStack] = useState<boolean[][]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [submittedAction, setSubmittedAction] = useState<{ action: CanvasAction; hash: Hex } | null>(null);
  const [confirmedAction, setConfirmedAction] = useState<CanvasAction | null>(null);
  const paintValue = useRef(true);
  const strokeStart = useRef<boolean[] | null>(null);
  const processedHash = useRef<Hex | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ownedTokens.length > 0 && !hasInitFromOwned.current && !searchParams.get('agent')) {
      hasInitFromOwned.current = true;
      setTokenInput(ownedTokens[0].toString());
    }
  }, [ownedTokens]);

  const tokenId = useMemo(() => BigInt(Math.max(1, Number(tokenInput) || 1)), [tokenInput]);

  const { data: supplyReads, isLoading: isSupplyLoading } = useReadContracts({
    contracts: [
      { ...artContract, functionName: 'totalSupply' },
      { ...artContract, functionName: 'PUBLIC_SUPPLY' },
    ],
  });
  const totalSupply = supplyReads?.[0]?.result;
  const publicSupply = supplyReads?.[1]?.result;
  const knownMissingPublicToken = typeof publicSupply === 'bigint' && tokenId <= publicSupply
    && typeof totalSupply === 'bigint' && tokenId > totalSupply;
  const shouldReadToken = !knownMissingPublicToken && typeof publicSupply === 'bigint';

  const { data: owner, isLoading: ownerLoading, error: ownerError } = useReadContract({
    ...artContract,
    functionName: 'ownerOf',
    args: [tokenId],
    query: { enabled: shouldReadToken, retry: false },
  });
  const { data: baseBitmap, refetch: refetchBase } = useReadContract({
    ...artContract,
    functionName: 'baseBitmap',
    args: [tokenId],
    query: { enabled: shouldReadToken, retry: false },
  });
  const { data: outlawBitmap, refetch: refetchOutlaw } = useReadContract({
    ...artContract,
    functionName: 'outlawBitmap',
    args: [tokenId],
    query: { enabled: shouldReadToken, retry: false },
  });
  const { data: canvasReads, refetch: refetchCanvas } = useReadContracts({
    contracts: [
      { ...canvasContract, functionName: 'maxAlteredPixelsFor', args: [address ?? zeroAddress] },
      { ...canvasContract, functionName: 'paused' },
      { ...canvasContract, functionName: 'delegateOf', args: [tokenId] },
      { ...canvasContract, functionName: 'isSealed', args: [tokenId] },
      { ...canvasContract, functionName: 'isOutlawActive', args: [tokenId] },
      { ...canvasContract, functionName: 'alteredPixels', args: [tokenId] },
      { ...canvasContract, functionName: 'overlayHash', args: [tokenId] },
    ],
    allowFailure: true,
  });

  const { writeContractAsync, isPending, error } = useWriteContract();
  const hash = submittedAction?.hash;
  const receipt = useWaitForTransactionReceipt({ hash });
  const busy = isPending || receipt.isLoading;
  const maxPixels = Number(canvasReads?.[0]?.result ?? 256n);
  const paused = canvasReads?.[1]?.result === true;
  const currentDelegate = canvasReads?.[2]?.result as string | undefined;
  const activeDelegate = currentDelegate && currentDelegate.toLowerCase() !== zeroAddress
    ? currentDelegate
    : undefined;
  const sealed = canvasReads?.[3]?.result === true;
  const outlawActive = canvasReads?.[4]?.result === true;
  const sealedCount = Number(canvasReads?.[5]?.result ?? 0);
  const sealedHash = canvasReads?.[6]?.result as string | undefined;
  const publicPixels = useMemo(() => decodeBitmap(baseBitmap), [baseBitmap]);
  const onChainOutlawPixels = useMemo(() => decodeBitmap(outlawBitmap), [outlawBitmap]);
  const tokenExists = !knownMissingPublicToken && Boolean(owner) && !ownerError;
  const ready = tokenExists && publicPixels.length === PIXEL_COUNT;
  const wallet = address?.toLowerCase();
  const isOwner = Boolean(wallet && owner?.toLowerCase() === wallet);
  const isDelegate = Boolean(wallet && activeDelegate?.toLowerCase() === wallet);
  const canEdit = isConnected && (isOwner || isDelegate) && !sealed && !paused;
  const overlay = useMemo(() => encodeOverlay(publicPixels, draftPixels), [publicPixels, draftPixels]);
  const pendingCount = useMemo(() => popcountHex(overlay), [overlay]);
  const displayPixels = mode === 'public'
    ? publicPixels
    : sealed ? onChainOutlawPixels : draftPixels;
  const canSeal = canEdit && pendingCount > 0 && pendingCount <= maxPixels;
  const delegateAddress = normalizedAddress(delegate);
  const canSetDelegate = isOwner && !sealed && Boolean(delegateAddress)
    && delegateAddress?.toLowerCase() !== activeDelegate?.toLowerCase();
  const canClearDelegate = isOwner && !sealed && Boolean(activeDelegate);
  const storageKey = address
    ? `loxleys:outlaw-draft:${chainId}:${contracts.loxleysArt.toLowerCase()}:${tokenId}:${address.toLowerCase()}`
    : '';

  useEffect(() => {
    if (!ready) {
      setDraftPixels([]);
      return;
    }
    let next = sealed ? onChainOutlawPixels : publicPixels;
    if (!sealed && storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) next = applyOverlay(publicPixels, validateDraft(JSON.parse(stored), chainId, tokenId, maxPixels));
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
    setDraftPixels(next);
    setUndoStack([]);
    setRedoStack([]);
    setDraftError('');
    setMode('outlaw');
  }, [ready, sealed, storageKey, chainId, tokenId, baseBitmap, outlawBitmap]);

  useEffect(() => {
    if (!storageKey || sealed || draftPixels.length !== PIXEL_COUNT || publicPixels.length !== PIXEL_COUNT) return;
    localStorage.setItem(storageKey, JSON.stringify(createDraft(chainId, tokenId, overlay)));
  }, [storageKey, sealed, draftPixels, publicPixels, chainId, tokenId, overlay]);

  useEffect(() => {
    function finishStroke() {
      if (!strokeStart.current) return;
      setUndoStack((current) => [...current, strokeStart.current as boolean[]]);
      setRedoStack([]);
      strokeStart.current = null;
    }
    window.addEventListener('pointerup', finishStroke);
    window.addEventListener('pointercancel', finishStroke);
    return () => {
      window.removeEventListener('pointerup', finishStroke);
      window.removeEventListener('pointercancel', finishStroke);
    };
  }, []);

  useEffect(() => {
    if (!receipt.isSuccess || !submittedAction || processedHash.current === submittedAction.hash) return;
    processedHash.current = submittedAction.hash;
    setConfirmedAction(submittedAction.action);
    if (submittedAction.action === 'seal') {
      setConfirmOpen(false);
      if (storageKey) localStorage.removeItem(storageKey);
      void refetchBase();
      void refetchOutlaw();
    } else if (submittedAction.action === 'delegate') {
      setDelegate('');
    }
    void refetchCanvas();
  }, [receipt.isSuccess, submittedAction, storageKey, refetchBase, refetchOutlaw, refetchCanvas]);

  function refresh() {
    void refetchBase();
    void refetchOutlaw();
    void refetchCanvas();
  }

  function setPixel(index: number, value: boolean) {
    if (!canEdit || mode !== 'outlaw') return;
    setDraftPixels((current) => {
      if (current[index] === value) return current;
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  function startPainting(event: PointerEvent<HTMLButtonElement>, index: number) {
    if (event.button !== 0 || !canEdit) return;
    event.preventDefault();
    strokeStart.current = [...draftPixels];
    paintValue.current = !draftPixels[index];
    setPixel(index, paintValue.current);
  }

  function continuePainting(event: PointerEvent<HTMLButtonElement>, index: number) {
    if ((event.buttons & 1) === 1) setPixel(index, paintValue.current);
  }

  function handlePixelKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if ((event.key !== 'Enter' && event.key !== ' ') || !canEdit) return;
    event.preventDefault();
    commitDraft(draftPixels.map((pixel, current) => current === index ? !pixel : pixel));
  }

  function commitDraft(next: boolean[]) {
    setUndoStack((current) => [...current, draftPixels]);
    setRedoStack([]);
    setDraftPixels(next);
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, draftPixels]);
    setDraftPixels(previous);
  }

  function redo() {
    const next = redoStack.at(-1);
    if (!next) return;
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current, draftPixels]);
    setDraftPixels(next);
  }

  function reset() {
    if (publicPixels.length === PIXEL_COUNT) commitDraft([...publicPixels]);
  }

  function sealOutlaw() {
    if (!canSeal) return;
    setConfirmedAction(null);
    void writeContractAsync({ ...canvasContract, functionName: 'sealOutlaw', args: [tokenId, overlay] })
      .then((txHash) => setSubmittedAction({ action: 'seal', hash: txHash }))
      .catch(() => undefined);
  }

  function submitDelegate(event: FormEvent) {
    event.preventDefault();
    if (!canSetDelegate || !delegateAddress) return;
    updateDelegate(delegateAddress);
  }

  function updateDelegate(nextDelegate: Address) {
    setConfirmedAction(null);
    void writeContractAsync({ ...canvasContract, functionName: 'setDelegate', args: [tokenId, nextDelegate] })
      .then((txHash) => setSubmittedAction({ action: 'delegate', hash: txHash }))
      .catch(() => undefined);
  }

  function setActiveIdentity(nextOutlawActive: boolean) {
    if (!sealed || !isOwner || nextOutlawActive === outlawActive) return;
    setConfirmedAction(null);
    void writeContractAsync({ ...canvasContract, functionName: 'setActiveIdentity', args: [tokenId, nextOutlawActive] })
      .then((txHash) => setSubmittedAction({ action: 'identity', hash: txHash }))
      .catch(() => undefined);
  }

  function exportDraft() {
    const payload = createDraft(chainId, tokenId, overlay);
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `loxley-${tokenId}-outlaw.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importDraft(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || publicPixels.length !== PIXEL_COUNT) return;
    try {
      const imported = validateDraft(JSON.parse(await file.text()), chainId, tokenId, maxPixels);
      commitDraft(applyOverlay(publicPixels, imported));
      setDraftError('');
      setMode('outlaw');
    } catch (cause) {
      setDraftError(cause instanceof Error ? cause.message : 'Draft could not be imported.');
    }
  }

  return (
    <>
      <PageShell kicker="Canvas" title="Public / Outlaw identity">
        <TokenSelector
          ownedTokens={ownedTokens}
          selectedToken={tokenInput}
          onSelect={setTokenInput}
          isFetching={ownedFetching}
          onRefresh={() => refetchOwned()}
          isConnected={isConnected}
        />
        <div className="canvas-workspace">
          <section className="canvas-inspector terminal-box">
            <Field label="NFT token ID">
              <input value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} inputMode="numeric" />
            </Field>
            <Metric label="Token" value={isSupplyLoading || ownerLoading ? 'checking' : tokenExists ? `Loxley #${tokenId}` : 'not minted'} />
            <Metric label="Owner" value={shortAddress(owner)} />
            <Metric label="Your access" value={!isConnected ? 'connect wallet' : isOwner ? 'owner' : isDelegate ? 'delegate' : 'read only'} />
            <Metric label="Identity" value={sealed ? `${outlawActive ? 'Outlaw' : 'Public'} active` : 'Public'} />
            <Metric label="Altered pixels" value={`${sealed ? sealedCount : pendingCount} / ${maxPixels}`} />
            {maxPixels === 1_600 && <p className="canvas-note">Deployment artist mode: the full 40×40 canvas is available. NFT ownership or an active owner-granted delegation is still required.</p>}
            <Metric label="Delegate" value={activeDelegate ? shortAddress(activeDelegate) : 'none'} />
            {sealedHash && !/^0x0*$/.test(sealedHash) && <Metric label="Overlay hash" value={shortAddress(sealedHash)} />}
            <button className="terminal-action" onClick={refresh}><Fingerprint size={16} /> Refresh state</button>

            {sealed && (
              <div className="delegate-form">
                <Field label="Active identity">
                  <div className="identity-switch">
                    <button
                      className={!outlawActive ? 'active' : ''}
                      type="button"
                      disabled={busy || !isOwner || !outlawActive}
                      onClick={() => setActiveIdentity(false)}
                    >Public</button>
                    <button
                      className={outlawActive ? 'active' : ''}
                      type="button"
                      disabled={busy || !isOwner || outlawActive}
                      onClick={() => setActiveIdentity(true)}
                    >Outlaw</button>
                  </div>
                </Field>
                {!isOwner && <p className="canvas-note">Only the current owner can change the active identity.</p>}
              </div>
            )}

            {!sealed && isOwner ? (
              <form className="delegate-form" onSubmit={submitDelegate}>
                <Field label="Delegate editor">
                  <input
                    value={delegate}
                    onChange={(event) => setDelegate(event.target.value)}
                    placeholder="0x..."
                    aria-invalid={delegate.length > 0 && !delegateAddress}
                  />
                </Field>
                <div className="delegate-actions">
                  <button className="terminal-action compact" disabled={busy || !canSetDelegate}>
                    <UserRoundCog size={16} /> Set delegate
                  </button>
                  <button
                    className="ghost-action compact"
                    type="button"
                    disabled={busy || !canClearDelegate}
                    onClick={() => updateDelegate(zeroAddress)}
                  >
                    <UserRoundX size={16} /> Clear
                  </button>
                </div>
                {delegate.length > 0 && !delegateAddress && <p className="form-error">Enter a valid wallet address.</p>}
              </form>
            ) : (
              <div className="delegate-form">
                <p className="canvas-note">
                  {sealed
                    ? 'Delegate management is permanently locked after the Outlaw identity is sealed.'
                    : !isConnected
                      ? 'Connect the owner wallet to manage delegation.'
                      : 'Only the current owner can manage delegation.'}
                </p>
              </div>
            )}
          </section>

          <section className="canvas-main">
            <div className="canvas-toolbar">
              <div className="identity-switch" aria-label="Identity view">
                <button className={mode === 'public' ? 'active' : ''} onClick={() => setMode('public')} type="button">Public</button>
                <button className={mode === 'outlaw' ? 'active' : ''} onClick={() => setMode('outlaw')} type="button">Outlaw</button>
              </div>
              <div className="canvas-tools">
                <button type="button" className="icon-tool" title="Undo" aria-label="Undo" disabled={!canEdit || undoStack.length === 0} onClick={undo}><Undo2 size={18} /></button>
                <button type="button" className="icon-tool" title="Redo" aria-label="Redo" disabled={!canEdit || redoStack.length === 0} onClick={redo}><Redo2 size={18} /></button>
                <button type="button" className="icon-tool" title="Reset Outlaw draft" aria-label="Reset Outlaw draft" disabled={!canEdit || pendingCount === 0} onClick={reset}><RotateCcw size={18} /></button>
              </div>
            </div>

            <div className={ready ? 'edit-pixel-grid' : 'edit-pixel-grid empty'}>
              {ready ? displayPixels.map((isOn, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Pixel ${index}`}
                  className={`edit-pixel${isOn ? ' on' : ''}`}
                  disabled={!canEdit || mode === 'public'}
                  onPointerDown={(event) => startPainting(event, index)}
                  onPointerEnter={(event) => continuePainting(event, index)}
                  onKeyDown={(event) => handlePixelKey(event, index)}
                />
              )) : <span>{isSupplyLoading || ownerLoading ? 'Loading token...' : 'Enter a minted token ID.'}</span>}
            </div>

            <div className="canvas-footer">
              <strong className={pendingCount > maxPixels ? 'over-limit' : ''}>{sealed ? sealedCount : pendingCount} / {maxPixels}</strong>
              <div className="canvas-file-actions">
                <input ref={fileInput} type="file" accept="application/json" hidden onChange={importDraft} />
                <button className="ghost-action" type="button" disabled={!canEdit} onClick={() => fileInput.current?.click()}><Upload size={16} /> Import</button>
                <button className="ghost-action" type="button" disabled={!ready || sealed} onClick={exportDraft}><Download size={16} /> Export</button>
                <button className="shadow-button" type="button" disabled={busy || !canSeal} onClick={() => setConfirmOpen(true)}><LockKeyhole size={16} /> Seal Outlaw</button>
              </div>
            </div>

            {pendingCount > maxPixels && <p className="form-error">Outlaw identity exceeds the {maxPixels}-pixel limit.</p>}
            {paused && <p className="form-error">Canvas sealing is paused on-chain.</p>}
            {sealed && <p className="canvas-note">This Outlaw identity is permanently sealed.</p>}
            {tokenExists && !isConnected && <p className="canvas-note">Connect the owner or delegate wallet to edit.</p>}
            {tokenExists && isConnected && !isOwner && !isDelegate && <p className="canvas-note">This wallet has read-only access.</p>}
            {draftError && <p className="form-error">{draftError}</p>}
            {hash && <p className="tx-note">Transaction: <a href={`${explorerBaseUrl}/tx/${hash}`} target="_blank" rel="noreferrer">{shortAddress(hash)}</a></p>}
            {confirmedAction && (
              <p className="ok-text">
                {confirmedAction === 'delegate'
                  ? 'Delegate updated.'
                  : confirmedAction === 'identity'
                    ? 'Active identity updated.'
                    : 'Outlaw identity sealed.'}
              </p>
            )}
            {error && <p className="form-error">{friendlyError(error)}</p>}
          </section>
        </div>
      </PageShell>

      {confirmOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !busy && setConfirmOpen(false)}>
          <section className="seal-modal" role="dialog" aria-modal="true" aria-labelledby="seal-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" aria-label="Close" title="Close" disabled={busy} onClick={() => setConfirmOpen(false)}><X size={20} /></button>
            <p className="section-kicker">Permanent action</p>
            <h2 id="seal-title">Seal Outlaw identity</h2>
            <div className="identity-compare">
              <IdentityPreview label="Public" pixels={publicPixels} />
              <IdentityPreview label="Outlaw" pixels={draftPixels} />
            </div>
            <p>These {pendingCount} pixel changes cannot be edited or removed after confirmation.</p>
            <button className="shadow-button" type="button" disabled={busy || !canSeal} onClick={sealOutlaw}><LockKeyhole size={16} /> Confirm seal</button>
          </section>
        </div>
      )}
    </>
  );
}

function IdentityPreview({ label, pixels }: { label: string; pixels: boolean[] }) {
  return <figure><div className="mini-pixel-grid">{pixels.map((on, index) => <span key={index} className={on ? 'on' : ''} />)}</div><figcaption>{label}</figcaption></figure>;
}

function normalizedAddress(value: string): Address | undefined {
  const trimmed = value.trim();
  return isAddress(trimmed) ? getAddress(trimmed) : undefined;
}

function decodeBitmap(bitmap: unknown): boolean[] {
  if (typeof bitmap !== 'string' || !/^0x[0-9a-fA-F]{400}$/.test(bitmap)) return [];
  const hex = bitmap.slice(2);
  return Array.from({ length: PIXEL_COUNT }, (_, index) => {
    const byte = Number.parseInt(hex.slice((index >> 3) * 2, (index >> 3) * 2 + 2), 16);
    return ((byte >> (7 - (index & 7))) & 1) === 1;
  });
}

function encodeOverlay(base: boolean[], final: boolean[]): Hex {
  const bytes = new Uint8Array(BYTE_COUNT);
  if (base.length !== PIXEL_COUNT || final.length !== PIXEL_COUNT) return bytesToHex(bytes);
  for (let index = 0; index < PIXEL_COUNT; index += 1) {
    if (base[index] !== final[index]) bytes[index >> 3] |= 1 << (7 - (index & 7));
  }
  return bytesToHex(bytes);
}

function applyOverlay(base: boolean[], overlay: Hex): boolean[] {
  const changes = decodeBitmap(overlay);
  return base.map((pixel, index) => pixel !== changes[index]);
}

function popcountHex(value: Hex): number {
  let count = 0;
  for (const char of value.slice(2)) {
    let nibble = Number.parseInt(char, 16);
    while (nibble) { count += nibble & 1; nibble >>= 1; }
  }
  return count;
}

function createDraft(chainId: number, tokenId: bigint, overlay: Hex): DraftPayload {
  return {
    version: 1,
    chainId,
    artContract: contracts.loxleysArt,
    tokenId: tokenId.toString(),
    overlay,
    alteredPixels: popcountHex(overlay),
    overlayHash: keccak256(overlay),
  };
}

function validateDraft(value: unknown, chainId: number, tokenId: bigint, maxPixels: number): Hex {
  const draft = value as Partial<DraftPayload>;
  if (draft.version !== 1) throw new Error('Unsupported draft version.');
  if (draft.chainId !== chainId) throw new Error('Draft belongs to another chain.');
  if (draft.artContract?.toLowerCase() !== contracts.loxleysArt.toLowerCase()) throw new Error('Draft belongs to another collection.');
  if (draft.tokenId !== tokenId.toString()) throw new Error('Draft belongs to another token.');
  if (typeof draft.overlay !== 'string' || !/^0x[0-9a-fA-F]{400}$/.test(draft.overlay)) throw new Error('Draft overlay must be 200 bytes.');
  const count = popcountHex(draft.overlay);
  if (count !== draft.alteredPixels || count > maxPixels) throw new Error('Draft pixel count is invalid.');
  if (keccak256(draft.overlay) !== draft.overlayHash) throw new Error('Draft checksum is invalid.');
  return draft.overlay;
}
