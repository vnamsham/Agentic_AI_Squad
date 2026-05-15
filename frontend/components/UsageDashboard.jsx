import React, { useState, useEffect } from 'react';
import * as api from '../client.js';
import { Spinner, SectionLabel, fmtDate } from './UI.jsx';

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 160, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function fmtTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function fmtCost(n) {
  return '$' + (n || 0).toFixed(4);
}

const AGENT_TYPE_LABELS = {
  'lead-agent':       'Lead',
  'developer-agent':  'Developer',
  'tester-agent':     'Tester',
  'regression-agent': 'Regression',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UsageDashboard() {
  const [data,          setData]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [filterProject, setFilterProject] = useState('');
  const [filterAgent,   setFilterAgent]   = useState('');

  useEffect(() => {
    setLoading(true);
    api.getUsage()
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <Spinner /> <span style={{ marginLeft: 10, color: 'var(--text3)' }}>Loading usage data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="alert alert-error">
          <span>⚠️</span>
          <div><strong>Failed to load usage data:</strong> {error}</div>
        </div>
      </div>
    );
  }

  const steps   = data?.steps   || [];
  const summary = data?.summary || {};

  // Derived filter options
  const projectNames = [...new Set(steps.map(s => s.projectName))].sort();
  const agentTypes   = [...new Set(steps.map(s => s.agentType))].filter(Boolean).sort();

  // Apply filters
  const visible = steps.filter(s => {
    if (filterProject && s.projectName !== filterProject) return false;
    if (filterAgent   && s.agentType   !== filterAgent)   return false;
    return true;
  });

  // Filtered totals
  const filteredTotals = {
    inputTokens:      visible.reduce((acc, s) => acc + s.inputTokens,      0),
    outputTokens:     visible.reduce((acc, s) => acc + s.outputTokens,     0),
    estimatedCostUsd: visible.reduce((acc, s) => acc + s.estimatedCostUsd, 0),
  };

  const hasFilters = filterProject || filterAgent;

  return (
    <div className="page">
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, marginBottom: 4 }}>
          Usage &amp; Cost
        </h1>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          Token consumption and estimated cost across all projects and runs.
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard
          label="Total Input Tokens"
          value={fmtTokens(summary.totalInputTokens || 0)}
          sub={`${summary.totalInputTokens?.toLocaleString() || 0} tokens`}
        />
        <StatCard
          label="Total Output Tokens"
          value={fmtTokens(summary.totalOutputTokens || 0)}
          sub={`${summary.totalOutputTokens?.toLocaleString() || 0} tokens`}
        />
        <StatCard
          label="Estimated Cost"
          value={fmtCost(summary.totalCostUsd)}
          sub="USD — approximate"
        />
        <StatCard
          label="Steps Run"
          value={summary.totalSteps || 0}
          sub={`across ${summary.totalRuns || 0} run${summary.totalRuns !== 1 ? 's' : ''}`}
        />
      </div>

      {/* Table Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Step Detail</div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              className="input"
              style={{ fontSize: 12, padding: '4px 8px', height: 30, cursor: 'pointer' }}
              value={filterProject}
              onChange={e => setFilterProject(e.target.value)}
            >
              <option value="">All Projects</option>
              {projectNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <select
              className="input"
              style={{ fontSize: 12, padding: '4px 8px', height: 30, cursor: 'pointer' }}
              value={filterAgent}
              onChange={e => setFilterAgent(e.target.value)}
            >
              <option value="">All Agent Types</option>
              {agentTypes.map(t => (
                <option key={t} value={t}>{AGENT_TYPE_LABELS[t] || t}</option>
              ))}
            </select>

            {hasFilters && (
              <button
                className="btn btn-sm"
                onClick={() => { setFilterProject(''); setFilterAgent(''); }}
                style={{ fontSize: 11, padding: '4px 10px' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text4)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text3)', marginBottom: 6 }}>
              {steps.length === 0 ? 'No usage data yet' : 'No results match your filters'}
            </div>
            <div style={{ fontSize: 12 }}>
              {steps.length === 0
                ? 'Run a pipeline or single agent to start capturing token usage.'
                : 'Try clearing your filters to see all records.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg2)' }}>
                  {['Run', 'Project', 'Agent', 'Type', 'Input Tokens', 'Output Tokens', 'Cost (USD)', 'Model', 'Date'].map(h => (
                    <th key={h} style={{
                      padding: '8px 12px', textAlign: h === 'Run' || h === 'Agent' || h === 'Project' || h === 'Model' || h === 'Date' ? 'left' : 'right',
                      fontWeight: 700, color: 'var(--text3)', fontSize: 11,
                      textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((s, i) => (
                  <tr key={`${s.runId}-${s.agentId}-${i}`}
                    style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}
                  >
                    <td style={{ padding: '8px 12px', color: 'var(--text3)', fontFamily: 'monospace', fontSize: 11 }}>
                      {(s.storyKey || s.runId || '').slice(0, 16)}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.projectName}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                      {s.agentName}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                        background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)',
                      }}>
                        {AGENT_TYPE_LABELS[s.agentType] || s.agentType || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                      {(s.inputTokens || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                      {(s.outputTokens || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--green)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtCost(s.estimatedCostUsd)}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text3)', fontSize: 11, fontFamily: 'monospace' }}>
                      {s.model}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text4)', whiteSpace: 'nowrap' }}>
                      {s.completedAt ? fmtDate(s.completedAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg2)', fontWeight: 700 }}>
                  <td colSpan={4} style={{ padding: '8px 12px', color: 'var(--text3)', fontSize: 11 }}>
                    {hasFilters ? `Filtered total (${visible.length} steps)` : `Total (${visible.length} steps)`}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                    {filteredTotals.inputTokens.toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                    {filteredTotals.outputTokens.toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtCost(filteredTotals.estimatedCostUsd)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
