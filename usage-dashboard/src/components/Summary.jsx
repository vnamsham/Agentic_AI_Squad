import React from 'react';

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function fmtCost(usd) {
  return '$' + (usd || 0).toFixed(6);
}

export default function Summary({ summary }) {
  if (!summary) {
    return (
      <div className="summary-grid" style={{ marginBottom: 24 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="stat-card">
            <div className="skeleton" />
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    { label: 'Total Runs',          value: fmt(summary.runCount || 0),          cls: '' },
    { label: 'Total Input Tokens',  value: fmt(summary.totalInputTokens || 0),  cls: 'accent' },
    { label: 'Total Output Tokens', value: fmt(summary.totalOutputTokens || 0), cls: 'accent' },
    { label: 'Total Cost',          value: fmtCost(summary.totalCostUsd),       cls: 'green' },
  ];

  return (
    <div className="summary-grid">
      {stats.map(s => (
        <div key={s.label} className="stat-card">
          <div className="stat-label">{s.label}</div>
          <div className={`stat-value ${s.cls}`}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}
