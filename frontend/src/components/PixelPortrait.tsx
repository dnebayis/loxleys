import { Grid3X3 } from 'lucide-react';
import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { loxleysArtAbi } from '../abis';
import { contracts } from '../web3/contracts';

type PixelPortraitProps = {
  tokenId?: bigint;
  caption?: string;
  className?: string;
};

export function PixelPortrait({ tokenId = 1n, caption, className = '' }: PixelPortraitProps) {
  const { data: bitmap, isLoading, error } = useReadContract({
    address: contracts.loxleysArt,
    abi: loxleysArtAbi,
    functionName: 'renderedBitmap',
    args: [tokenId],
    query: { retry: false },
  });
  const pixels = useMemo(() => decodeBitmap(bitmap), [bitmap]);
  const ready = pixels.length === 1600;

  return (
    <div className={`pixel-stage ${className}`.trim()} aria-label={`Loxley ${tokenId} on-chain portrait`}>
      <div className={ready ? 'pixel-grid' : 'pixel-grid loading'}>
        {ready ? pixels.map((isOn, index) => (
          <span key={index} className={isOn ? 'pixel on' : 'pixel'} />
        )) : <span>{isLoading ? 'Reading on-chain art...' : error ? 'Portrait unavailable' : 'Waiting for token'}</span>}
      </div>
      <div className="stage-caption">
        <Grid3X3 size={16} />
        {caption || `Loxley #${tokenId} // on-chain bitmap`}
      </div>
    </div>
  );
}

function decodeBitmap(bitmap: unknown): boolean[] {
  if (typeof bitmap !== 'string' || !bitmap.startsWith('0x') || bitmap.length !== 402) return [];
  const hex = bitmap.slice(2);
  return Array.from({ length: 1600 }, (_, index) => {
    const byte = Number.parseInt(hex.slice((index >> 3) * 2, (index >> 3) * 2 + 2), 16);
    return ((byte >> (7 - (index & 7))) & 1) === 1;
  });
}
