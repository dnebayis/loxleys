import { RefreshCw } from 'lucide-react';
import { TokenThumb } from './TokenThumb';

type Props = {
  ownedTokens: bigint[];
  selectedToken: string;
  onSelect: (tokenId: string) => void;
  isFetching: boolean;
  onRefresh: () => void;
  isConnected: boolean;
};

export function TokenSelector({ ownedTokens, selectedToken, onSelect, isFetching, onRefresh, isConnected }: Props) {
  if (!isConnected || ownedTokens.length === 0) return null;

  return (
    <div className="tk-bar">
      <span className="tk-label">Your tokens</span>
      <div className="tk-list">
        {ownedTokens.map((id) => {
          const idStr = id.toString();
          return (
            <button
              key={idStr}
              className={`tk-item ${idStr === selectedToken ? 'tk-active' : ''}`}
              onClick={() => onSelect(idStr)}
            >
              <TokenThumb tokenId={id} size={32} />
              <span>#{idStr}</span>
            </button>
          );
        })}
      </div>
      <button className="tk-refresh" onClick={onRefresh} disabled={isFetching} title="Refresh">
        <RefreshCw size={13} />
      </button>
    </div>
  );
}
