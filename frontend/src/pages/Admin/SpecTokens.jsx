import { createContext, useContext } from 'react';

export const TokenContext = createContext({});

export function Token({ name }) {
  const tokens = useContext(TokenContext);
  return <code className="spec-token" title={`--${name}`}>{tokens[name] || '—'}</code>;
}

export function Value({ name }) {
  const tokens = useContext(TokenContext);
  return <span title={`--${name}`}>{tokens[name] || '—'}</span>;
}

export function TypeMetrics({ size, weight = 'regular', lineHeight = 'body' }) {
  return <code><Value name={`font-size-${size}`} /> / <Value name={`font-weight-${weight}`} /> / <Value name={`line-height-${lineHeight}`} /></code>;
}
