import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

export function PageShell({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="section-kicker">{kicker}</p>
        <h1>{title}</h1>
      </div>
      {children}
    </section>
  );
}

export function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="status-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function DataBlock({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <article className="feature-block">
      <Icon size={22} />
      <h2>{title}</h2>
      <p>{text}</p>
    </article>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function formatBigInt(value: unknown) {
  return typeof value === 'bigint' ? value.toString() : '...';
}

export function shortAddress(address?: string) {
  if (!address) return '...';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function friendlyError(error: unknown) {
  if (!error || typeof error !== 'object') return '';
  const value = error as { shortMessage?: string; message?: string };
  return value.shortMessage || value.message?.split('\n')[0] || 'Transaction failed.';
}
