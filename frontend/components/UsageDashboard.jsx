import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../AppContext.jsx';
import { Spinner, fmtDate, statusTag } from './UI.jsx';
import * as api from '../client.js';

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatCost(usd) {
  if (usd === null || usd === undefined) return '—';
  return '$' + Number(usd).toFixed(4);
}

function formatTokens(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString();
}

function formatDuration(ms) {
  if (ms === null || ms === undefined) return '—';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, loading }) {
  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
        {loading ? <Spinner /> : value}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UsageDashboard() {
  const { state, actions } = useApp();
  const [data, setData]                       = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const fetchUsage = useCallback(async (projectId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getUsage(projectId);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage(selectedProjectId);
  }, [selectedProjectId, fetchUsage]);

  function handleProjectChange(e) {
    setSelectedProjectId(e.target.value);
  }

  function handleRunClick(row) {
    actions.setProject(row.projectId);
    if (row.storyKey) actions.setStory({ key: row.storyKey, summary: row.storyKey });
    actions.setPage('agent-studio');
  }

  const summary   = data?.summary   || {};
  const byProject = data?.byProject || [];
  const recentRuns= data?.recentRuns|| [];

  const totalTokensDisplay = (summary.totalInputTokens || summary.totalOutputTokens)
    ? formatTokens((summary.totalInputTokens || 0) + (summary.totalOutputTokens || 0))
    : '—';

  return (
    <div className="page-content" style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, marginBottom: 4 }}>
            Usage &amp; Cost
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>
            Token consumption and estimated spend across all agent runs
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            className="input"
            value={selectedProjectId}
            onChange={handleProjectChange}
            style={{ width: 220, cursor: 'pointer' }}
          >
            <option value="">All Projects</option>
            {state.projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            className="btn btn-secondary"
            onClick={() => fetchUsage(selectedProjectId)}
            disabled={loading}
            style={{ whiteSpace: 'nowrap' }}
          >
            {loading ? <Spinner /> : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── Summary Cards ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <SummaryCard label="Total Runs"    value={loading ? null : (summary.totalRuns ?? '—').toLocaleString?.() ?? summary.totalRuns} loading={loading} />
        <SummaryCard label="Total Tokens"  value={loading ? null : totalTokensDisplay}   loading={loading} />
        <SummaryCard label="Total Cost"    value={loading ? null : formatCost(summary.totalCostUsd)}    loading={loading} />
        <SummaryCard label="Avg Cost / Run" value={loading ? null : formatCost(summary.avgCostPerRun)} loading={loading} />
      </div>

      {/* ── Per-Project Table ─────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">By Project</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                {['Project', 'Runs', 'Input Tokens', 'Output Tokens', 'Cache Tokens', 'Total Cost', 'Avg Cost'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byProject.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text4)', fontSize: 13 }}>
                    No project data available
                  </td>
                </tr>
              ) : byProject.map((proj, i) => (
                <tr key={proj.projectId} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg2)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text)' }}>{proj.projectName}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text3)' }}>{proj.runCount}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text3)', fontFamily: 'monospace' }}>{formatTokens(proj.totalInputTokens)}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text3)', fontFamily: 'monospace' }}>{formatTokens(proj.totalOutputTokens)}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text3)', fontFamily: 'monospace' }}>{formatTokens(proj.totalCacheReadTokens)}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--green)', fontWeight: 700 }}>{formatCost(proj.totalCostUsd)}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text3)' }}>{formatCost(proj.avgCostPerRun)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Recent Runs Table ─────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Recent Runs <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text4)' }}>(last 50)</span></div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {recentRuns.length === 0 && !loading ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text4)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text3)', marginBottom: 6 }}>No runs recorded yet</div>
              <div style={{ fontSize: 13 }}>Start a workflow to see usage data here.</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                  {['Timestamp', 'Project', 'Story', 'Status', 'Duration', 'Tokens (in+out)', 'Cost'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run, i) => {
                  const tokens = (run.inputTokens !== null && run.outputTokens !== null)
                    ? formatTokens((run.inputTokens || 0) + (run.outputTokens || 0))
                    : '—';
                  return (
                    <tr
                      key={run.runId}
                      onClick={() => handleRunClick(run)}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: i % 2 === 0 ? 'transparent' : 'var(--bg2)',
                        cursor: 'pointer',
                        transition: 'background .15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--bg2)'}
                    >
                      <td style={{ padding: '10px 16px', color: 'var(--text3)', whiteSpace: 'nowrap', fontSize: 12 }}>{run.createdAt ? fmtDate(run.createdAt) : '—'}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.projectName}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--accent)', fontFamily: 'monospace', fontSize: 12 }}>{run.storyKey || '—'}</td>
                      <td style={{ padding: '10px 16px' }}>{run.status ? statusTag(run.status) : '—'}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{formatDuration(run.durationMs)}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text3)', fontFamily: 'monospace' }}>{tokens}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--green)', fontWeight: 700 }}>{formatCost(run.costUsd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
