import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../AppContext.jsx';
import { Spinner } from './UI.jsx';
import * as api from '../client.js';

function fmt(n) { return (n || 0).toLocaleString(); }
function fmtCost(n) { return '$' + (n || 0).toFixed(4); }
function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

const STATUS_COLORS = {
  completed: 'var(--green)',
  failed:    'var(--red)',
  running:   'var(--accent)',
  default:   'var(--text3)',
};

function statusColor(s) { return STATUS_COLORS[s] || STATUS_COLORS.default; }

const TH = ({ children, right }) => (
  <th style={{
    padding: '8px 12px', textAlign: right ? 'right' : 'left',
    fontSize: 11, fontWeight: 700, color: 'var(--text3)',
    borderBottom: '1px solid var(--border)', background: 'var(--bg2)',
    textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
  }}>{children}</th>
);

const TD = ({ children, right, mono, muted }) => (
  <td style={{
    padding: '9px 12px', textAlign: right ? 'right' : 'left',
    fontSize: 13, color: muted ? 'var(--text3)' : 'var(--text)',
    fontFamily: mono ? 'var(--font-mono, monospace)' : undefined,
    borderBottom: '1px solid var(--border2)',
    whiteSpace: 'nowrap',
  }}>{children}</td>
);

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      flex: 1, minWidth: 140,
      background: accent ? 'var(--accent-bg)' : 'var(--surface)',
      border: `1px solid ${accent ? 'var(--accent-border)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)', padding: '16px 20px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent ? 'var(--accent)' : 'var(--text)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ViewToggle({ view, setView }) {
  const opts = [
    { id: 'summary', label: 'Summary' },
    { id: 'by-run',  label: 'By Run' },
    { id: 'by-model',label: 'By Model' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {opts.map(o => (
        <button key={o.id} onClick={() => setView(o.id)} style={{
          padding: '5px 14px', borderRadius: 20, border: '1px solid var(--border)',
          background: view === o.id ? 'var(--accent)' : 'var(--bg2)',
          color: view === o.id ? '#fff' : 'var(--text3)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function SummaryView({ data, showProject }) {
  if (!showProject) {
    // Show by-model when scoped to a project
    return <ModelView data={data} />;
  }
  const rows = data.byProject || [];
  if (!rows.length) return <EmptyState />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <TH>Project</TH><TH right>Runs</TH><TH right>Steps</TH>
          <TH right>Input Tokens</TH><TH right>Output Tokens</TH><TH right>Cost</TH>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.projectId}>
              <TD>{r.projectName}</TD>
              <TD right mono>{fmt(r.runCount)}</TD>
              <TD right mono>{fmt(r.stepCount)}</TD>
              <TD right mono>{fmt(r.inputTokens)}</TD>
              <TD right mono>{fmt(r.outputTokens)}</TD>
              <TD right mono>{fmtCost(r.costUsd)}</TD>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModelView({ data }) {
  const rows = data.byModel || [];
  if (!rows.length) return <EmptyState />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <TH>Model</TH><TH right>Steps</TH>
          <TH right>Input Tokens</TH><TH right>Output Tokens</TH><TH right>Cost</TH>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.model}>
              <TD><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.model}</span></TD>
              <TD right mono>{fmt(r.stepCount)}</TD>
              <TD right mono>{fmt(r.inputTokens)}</TD>
              <TD right mono>{fmt(r.outputTokens)}</TD>
              <TD right mono>{fmtCost(r.costUsd)}</TD>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepBreakdown({ steps }) {
  if (!steps?.length) return <div style={{ padding: '12px 24px', fontSize: 12, color: 'var(--text3)' }}>No step usage data recorded.</div>;
  return (
    <div style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border2)', padding: '0 0 8px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <TH>Agent</TH><TH>Type</TH><TH right>Input</TH><TH right>Output</TH><TH right>Cost</TH><TH>Model</TH>
        </tr></thead>
        <tbody>
          {steps.map((s, i) => (
            <tr key={i}>
              <TD>{s.agentName || s.agentId || '—'}</TD>
              <TD muted>{s.agentType || '—'}</TD>
              <TD right mono>{fmt(s.inputTokens)}</TD>
              <TD right mono>{fmt(s.outputTokens)}</TD>
              <TD right mono>{fmtCost(s.costUsd)}</TD>
              <TD muted><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{s.model || '—'}</span></TD>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RunsView({ data, showProject }) {
  const [expanded, setExpanded] = useState({});
  const rows = data.runs || [];
  if (!rows.length) return <EmptyState />;
  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <TH>Date</TH>
          {showProject && <TH>Project</TH>}
          <TH>Story</TH><TH>Status</TH><TH right>Agents</TH>
          <TH right>Input Tokens</TH><TH right>Output Tokens</TH><TH right>Cost</TH>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <React.Fragment key={r.runId}>
              <tr
                onClick={() => toggle(r.runId)}
                style={{ cursor: 'pointer', background: expanded[r.runId] ? 'var(--accent-bg)' : undefined }}
              >
                <TD muted>{fmtDate(r.startedAt)}</TD>
                {showProject && <TD>{r.projectName}</TD>}
                <TD><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.storyKey || '—'}</span></TD>
                <TD><span style={{ color: statusColor(r.status), fontWeight: 600, fontSize: 12 }}>{r.status}</span></TD>
                <TD right mono>{fmt(r.steps?.length)}</TD>
                <TD right mono>{fmt(r.inputTokens)}</TD>
                <TD right mono>{fmt(r.outputTokens)}</TD>
                <TD right mono>{fmtCost(r.costUsd)}</TD>
              </tr>
              {expanded[r.runId] && (
                <tr>
                  <td colSpan={showProject ? 8 : 7} style={{ padding: 0 }}>
                    <StepBreakdown steps={r.steps} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text3)' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>No usage data yet</div>
      <div style={{ fontSize: 13 }}>Run an agent pipeline to see token usage here.</div>
    </div>
  );
}

export default function UsageDashboard({ projectId = null }) {
  const { state } = useApp();
  const activeProject = projectId
    ? state.projects.find(p => p.id === projectId)
    : null;

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [view, setView]       = useState('summary');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = projectId
        ? await api.getProjectUsage(projectId)
        : await api.getGlobalUsage();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const summary = data?.summary || {};
  const showProject = !projectId;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Usage & Cost</h1>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
            {activeProject ? activeProject.name : 'Global — all projects'}
          </div>
        </div>
        <button onClick={load} disabled={loading} style={{
          padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginBottom: 20, padding: '12px 16px', borderRadius: 8,
          background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', fontSize: 13,
        }}>⚠ {error}</div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
      )}

      {/* Content */}
      {data && (
        <>
          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
            <StatCard label="Input Tokens"  value={fmt(summary.totalInputTokens)}  />
            <StatCard label="Output Tokens" value={fmt(summary.totalOutputTokens)} />
            <StatCard label="Total Cost"    value={fmtCost(summary.totalCostUsd)}  accent sub="USD, 4 decimal places" />
            <StatCard label="Total Runs"    value={fmt(summary.totalRuns)}         sub={`${fmt(summary.totalSteps)} agent steps`} />
          </div>

          {/* View toggle + table */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                {view === 'summary' ? (showProject ? 'By Project' : 'By Model') : view === 'by-run' ? 'Runs' : 'By Model'}
              </span>
              <ViewToggle view={view} setView={setView} />
            </div>
            {view === 'summary'  && <SummaryView  data={data} showProject={showProject} />}
            {view === 'by-run'   && <RunsView     data={data} showProject={showProject} />}
            {view === 'by-model' && <ModelView    data={data} />}
          </div>
        </>
      )}

      {!loading && !error && !data && <EmptyState />}
    </div>
  );
}
