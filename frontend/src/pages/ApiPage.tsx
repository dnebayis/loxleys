import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Metric, PageShell } from '../components/ui';
import { publicApiBaseUrl } from '../web3/contracts';

const probes = [
  '/',
  '/health',
  '/openapi.json',
  '/.well-known/agent.json',
  '/agents/binding/1',
  '/agents/readiness/1',
  '/agents/info/1',
  '/agents/metadata/1',
  '/agents/agent-card/1',
  '/agents/1/canvas',
  '/agents/1/memories',
  '/agents/1/capabilities',
  '/agents/1/alliances',
  '/agents/1/prompt.txt',
  '/agents/list',
  '/llms.txt',
];

type ProbeResult = {
  route: string;
  status: string;
  ok: boolean;
};

export function ApiPage() {
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string>('not checked');

  async function checkRoutes() {
    setChecking(true);
    const next = await Promise.all(
      probes.map(async (route) => {
        try {
          const response = await fetch(`${publicApiBaseUrl}${route}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });
          const contentType = response.headers.get('content-type') || 'unknown';
          const isJson = contentType.includes('application/json');
          const expectedType = route.endsWith('.txt') ? contentType.includes('text/plain') : isJson;
          return {
            route,
            status: `${response.status} ${response.statusText || 'OK'} · ${isJson ? 'JSON' : contentType.split(';')[0]}`,
            ok: response.ok && expectedType,
          };
        } catch (error) {
          return {
            route,
            status: error instanceof Error ? error.message : 'request failed',
            ok: false,
          };
        }
      }),
    );
    setResults(next);
    setCheckedAt(new Date().toLocaleTimeString());
    setChecking(false);
  }

  useEffect(() => {
    void checkRoutes();
  }, []);

  return (
    <PageShell kicker="API" title="Agent API status">
        <div className="split-panel">
          <div className="action-copy api-copy">
            <p>Each row is requested from the configured public service. JSON routes expose live NFT state; text routes are compact discovery context designed for LLMs.</p>
            <a className="inline-link" href={`${publicApiBaseUrl}/openapi.json`} target="_blank" rel="noreferrer">OpenAPI 3.1 document</a>
            <a className="inline-link" href={`${publicApiBaseUrl}/llms.txt`} target="_blank" rel="noreferrer">LLM route index</a>
            <a className="inline-link" href={`${publicApiBaseUrl}/agents/1/prompt.txt`} target="_blank" rel="noreferrer">Provider-neutral agent prompt</a>
            <button className="shadow-button" onClick={() => void checkRoutes()} disabled={checking}>
              <RefreshCw size={16} />
              Check endpoints
            </button>
          </div>

          <div className="terminal-box">
            <Metric label="Last check" value={checkedAt} />
            {results.map((result) => (
              <Metric
                key={result.route}
                label={result.route}
                value={<span className={result.ok ? 'ok-text' : 'warn-text'}>{result.status}</span>}
              />
            ))}
          </div>
        </div>
    </PageShell>
  );
}
