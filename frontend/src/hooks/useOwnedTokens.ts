import { useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { loxleysArtAbi } from '../abis';
import { contracts } from '../web3/contracts';

const artContract = { address: contracts.loxleysArt, abi: loxleysArtAbi } as const;
export function useOwnedTokens() {
  const { address, isConnected } = useAccount();
  const [ownedTokens, setOwnedTokens] = useState<bigint[]>([]);

  const { data: supplyData } = useReadContracts({
    contracts: [{ ...artContract, functionName: 'totalSupply' }],
    allowFailure: true,
  });

  const totalSupply = typeof supplyData?.[0]?.result === 'bigint' ? supplyData[0].result : 0n;

  const allMintedIds = useMemo(() => {
    const ids: bigint[] = [];
    for (let i = 1n; i <= totalSupply; i++) ids.push(i);
    return ids;
  }, [totalSupply]);

  const ownerCalls = useMemo(
    () => allMintedIds.map((id) => ({ ...artContract, functionName: 'ownerOf' as const, args: [id] as const })),
    [allMintedIds],
  );

  const { data: ownerResults, refetch, isFetching } = useReadContracts({
    contracts: ownerCalls,
    allowFailure: true,
  });

  useEffect(() => {
    if (!address || !ownerResults) { setOwnedTokens([]); return; }
    const lowerAddr = address.toLowerCase();
    const owned: bigint[] = [];
    for (let i = 0; i < allMintedIds.length; i++) {
      const result = ownerResults[i]?.result;
      if (typeof result === 'string' && result.toLowerCase() === lowerAddr) {
        owned.push(allMintedIds[i]);
      }
    }
    setOwnedTokens(owned);
  }, [address, ownerResults, allMintedIds]);

  return { ownedTokens, isConnected, address, refetch, isFetching };
}
