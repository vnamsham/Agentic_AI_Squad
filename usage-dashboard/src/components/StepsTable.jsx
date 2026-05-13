import React from 'react';

function fmt(n) {
  return n != null ? Number(n).toLocaleString() : '—';
}

function fmtCost(n) {
  return n != null ? `$${Number(n).toFixed(6)}` : '—';
}

function statusTag(status) {
  const map = {
    completed: 'tag-green',
    failed:    'tag-red',
    running:   'tag-blue',
    pending:   'tag-yellow',
  };
  return <span className={`tag ${map[status] || 'tag-yellow'}`}>{status || 'unknown'}</span>;
}

export default function StepsTable({ steps }) {
  if (!steps || steps.length === 0) {
    return (
      <div style={{ padding: '16px 20px', color: 'var(--text4)', fontSize: 12 }}>
        No step detail available for this run.
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg2)', padding: '12px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        Steps ({steps.length})
      </div>
      <table style={{ width: '100%', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text3)', fontWeight: 600 }}>Agent</th>
            <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text3)', fontWeight: 600 }}>Type</th>
            <th style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--text3)', fontWeight: 600 }}>Input Tokens</th>
            <th style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--text3)', fontWeight: 600 }}>Output Tokens</th>
            <th style={{ textAlign: 'right', padding: '6px 10px', color: 'var(--text3)', fontWeight: 600 }}>Est. Cost (USD)</th>
            <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text3)', fontWeight: 600 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step, idx) => {
            const u = step.usage;
            return (
              <tr key={step.agentId || idx}>
                <td style={{ padding: '6px 10px', fontWeight: 600 }}>{step.agentName || '—'}</td>
                <td style={{ padding: '6px 10px', color: 'var(--text3)' }}>{step.agentType || '—'}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{fmt(u?.inputTokens)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{fmt(u?.outputTokens)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{fmtCost(u?.estimatedCostUsd)}</td>
                <td style={{ padding: '6px 10px' }}>{statusTag(step.status)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
