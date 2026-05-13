import React from 'react';

const DASH = '—';

function fmt(n) {
  return n != null ? Number(n).toLocaleString() : DASH;
}

function fmtCost(n) {
  return n != null ? `$${Number(n).toFixed(6)}` : DASH;
}

export default function SummaryCards({ aggregate, loading }) {
  const a = aggregate;

  const cards = [
    { label: 'Total Runs',          value: loading ? '…' : fmt(a?.runCount) },
    { label: 'Total Input Tokens',  value: loading ? '…' : fmt(a?.totalInputTokens) },
    { label: 'Total Output Tokens', value: loading ? '…' : fmt(a?.totalOutputTokens) },
    { label: 'Estimated Cost (USD)',value: loading ? '…' : fmtCost(a?.totalEstimatedCostUsd) },
  ];

  return (
    <div className="grid-4">
      {cards.map(card => (
        <div key={card.label} className="stat-card">
          <div className="stat-label">{card.label}</div>
          <div className="stat-value">{card.value}</div>
        </div>
      ))}
    </div>
  );
}
