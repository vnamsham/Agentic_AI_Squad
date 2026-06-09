import React, { useState } from 'react';
import StepsTable from './StepsTable.jsx';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

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

export default function RunsTable({ runs, loading }) {
  const [expandedRunId, setExpandedRunId] = useState(null);

  function toggle(runId) {
    setExpandedRunId(prev => (prev === runId ? null : runId));
  }

  if (loading && runs.length === 0) {
    return (
      <div className="card">
        <div className="card-header"><span className="card-title">Runs</span></div>
        <div className="empty-state">Loading…</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          Runs
          <span style={{ fontWeight: 400, color: 'var(--text3)', marginLeft: 8, fontSize: 12 }}>
            ({runs.length})
          </span>
        </span>
        <span style={{ fontSize: 11, color: 'var(--text4)' }}>Click a row to expand steps</span>
      </div>

      {runs.length === 0 ? (
        <div className="empty-state">No runs found. Run an agent pipeline to see usage data here.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Story Key</th>
              <th>Project</th>
              <th>Started At</th>
              <th>Agents</th>
              <th>Input Tokens</th>
              <th>Output Tokens</th>
              <th>Est. Cost (USD)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {runs.map(run => {
              const isExpanded = expandedRunId === run.runId;
              const u = run.totalUsage;
              return (
                <React.Fragment key={run.runId}>
                  <tr onClick={() => toggle(run.runId)} style={{ background: isExpanded ? 'var(--accent-bg)' : undefined }}>
                    <td style={{ fontWeight: 600 }}>{run.storyKey || '—'}</td>
                    <td>{run.projectName}</td>
                    <td style={{ color: 'var(--text3)' }}>{fmtDate(run.startedAt)}</td>
                    <td>{(run.steps || []).map(s => s.agentName).filter(Boolean).join(', ') || '—'}</td>
                    <td>{fmt(u?.inputTokens)}</td>
                    <td>{fmt(u?.outputTokens)}</td>
                    <td style={{ fontWeight: 600 }}>{fmtCost(u?.estimatedCostUsd)}</td>
                    <td>{statusTag(run.status)}</td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} style={{ padding: 0 }}>
                        <StepsTable steps={run.steps} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
