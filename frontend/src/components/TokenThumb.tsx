import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { loxleysArtAbi } from '../abis';
import { contracts } from '../web3/contracts';

export function TokenThumb({ tokenId, size = 44 }: { tokenId: bigint; size?: number }) {
  const { data: bitmap } = useReadContract({
    address: contracts.loxleysArt,
    abi: loxleysArtAbi,
    functionName: 'renderedBitmap',
    args: [tokenId],
    query: { retry: false },
  });

  const svgDataUri = useMemo(() => {
    if (typeof bitmap !== 'string' || !bitmap.startsWith('0x') || bitmap.length !== 402) return null;
    const hex = bitmap.slice(2);
    let rects = '';
    for (let y = 0; y < 40; y++) {
      let x = 0;
      while (x < 40) {
        const idx = y * 40 + x;
        const byte = Number.parseInt(hex.slice((idx >> 3) * 2, (idx >> 3) * 2 + 2), 16);
        const on = ((byte >> (7 - (idx & 7))) & 1) === 1;
        if (!on) { x++; continue; }
        const start = x;
        while (x < 40) {
          const ni = y * 40 + x;
          const nb = Number.parseInt(hex.slice((ni >> 3) * 2, (ni >> 3) * 2 + 2), 16);
          if (((nb >> (7 - (ni & 7))) & 1) !== 1) break;
          x++;
        }
        rects += `<rect x="${start}" y="${y}" width="${x - start}" height="1"/>`;
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" shape-rendering="crispEdges"><rect width="40" height="40" fill="#0A0A0A"/><g fill="#CDFF00">${rects}</g></svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }, [bitmap]);

  if (!svgDataUri) {
    return <div className="t-thumb t-thumb-empty" style={{ width: size, height: size }} />;
  }

  return <img src={svgDataUri} alt={`Loxley #${tokenId}`} className="t-thumb" style={{ width: size, height: size }} />;
}
