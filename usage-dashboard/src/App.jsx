import React, { useEffect, useState, useCallback } from 'react';
import { getProjects, getSummary, getRuns } from './client.js';

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtUsd(n) {
  return '$' + (n ?? 0).toFixed(4);
}

function fmtTokens(n) {
  return (n ?? 0).toLocaleString();
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  :root {
    --accent: #2563EB;
    --surface: #ffffff;
    --bg: #f5f6fa;
    --bg2: #eef0f5;
    --border: #e2e5ec;
    --text: #111827;
    --text3: #6b7280;
    --green: #16a34a;
    --green-bg: #f0fdf4;
    --green-border: #bbf7d0;
    --red: #dc2626;
    --red-bg: #fef2f2;
    --red-border: #fecaca;
    --blue: #2563eb;
    --blue-bg: #eff6ff;
    --blue-border: #bfdbfe;
    --yellow-bg: #fffbeb;
    --yellow-border: #fde68a;
    --yellow-text: #92400e;
    --radius: 10px;
  }
  body { background: var(--bg); color: var(--text); }
  .shell { max-width: 1100px; margin: 0 auto; padding: 0 24px 48px; }
  .header { display:flex; align-items:center; gap:16px; padding:20px 0 18px; border-bottom:1px solid var(--border); margin-bottom:24px; }
  .header h1 { font-size:22px; font-weight:800; flex:1; }
  .header select, .header button { padding:7px 14px; border-radius:8px; border:1px solid var(--border); font-size:13px; cursor:pointer; background:var(--surface); }
  .header button { background:var(--accent); color:#fff; border-color:var(--accent); font-weight:600; }
  .disclaimer { background:var(--yellow-bg); border:1px solid var(--yellow-border); color:var(--yellow-text); border-radius:var(--radius); padding:12px 16px; font-size:13px; margin-bottom:24px; }
  .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:28px; }
  .card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:20px 22px; }
  .card-val { font-size:28px; font-weight:800; color:var(--text); line-height:1.1; margin-bottom:6px; }
  .card-label { font-size:12px; color:var(--text3); font-weight:500; }
  .section-label { font-size:13px; font-weight:700; color:var(--text3); text-transform:uppercase; letter-spacing:.07em; margin-bottom:12px; }
  .table-wrap { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; margin-bottom:32px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  thead th { background:var(--bg2); padding:10px 14px; text-align:left; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text3); border-bottom:1px solid var(--border); }
  tbody td { padding:10px 14px; border-bottom:1px solid var(--border); vertical-align:middle; }
  tbody tr:last-child td { border-bottom:none; }
  tbody tr:hover { background:var(--bg); }
  .empty { text-align:center; padding:40px 24px; color:var(--text3); font-size:14px; }
  .pill { display:inline-block; padding:2px 10px; border-radius:20px; font-size:11px; font-weight:700; }
  .pill-green { background:var(--green-bg); color:var(--green); border:1px solid var(--green-border); }
  .pill-red   { background:var(--red-bg);   color:var(--red);   border:1px solid var(--red-border); }
  .pill-blue  { background:var(--blue-bg);  color:var(--blue);  border:1px solid var(--blue-border); }
  .pill-grey  { background:var(--bg2);      color:var(--text3); border:1px solid var(--border); }
  @media(max-width:700px){ .cards{ grid-template-columns:1fr 1fr; } }
`;

function StatusPill({ status }) {
  const cls = status === 'completed' ? 'pill-green' : status === 'failed' ? 'pill-red' : status === 'running' ? 'pill-blue' : 'pill-grey';
  return <span className={`pill ${cls}`}>{status || 'unknown'}</span>;
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [projects, setProjects]             = useState([]);
  const [selectedProjectId, setSelectedId] = useState('');
  const [summary, setSummary]               = useState(null);
  const [runs, setRuns]                     = useState([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projs, sum, runList] = await Promise.all([
        getProjects(),
        getSummary(selectedProjectId || undefined),
        getRuns(selectedProjectId || undefined, 50),
      ]);
      setProjects(projs);
      setSummary(sum);
      setRuns(runList);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalTokens = (summary?.totalInputTokens ?? 0) + (summary?.totalOutputTokens ?? 0);

  return (
    <>
      <style>{CSS}</style>
      <div className="shell">

        {/* Header */}
        <div className="header">
          <h1>📊 Usage &amp; Cost Dashboard</h1>
          <select value={selectedProjectId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button onClick={loadData} disabled={loading}>
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-border)', color:'var(--red)', borderRadius:'var(--radius)', padding:'12px 16px', marginBottom:20, fontSize:13 }}>
            ⚠️ Error: {error}
          </div>
        )}

        {/* Disclaimer */}
        <div className="disclaimer">
          ⚠️ Costs are estimates based on public Anthropic pricing. Cache-creation tokens are not included. Figures may differ from your actual Anthropic invoice.
        </div>

        {/* Summary Cards */}
        <div className="cards">
          <div className="card">
            <div className="card-val">{(summary?.totalRuns ?? 0).toLocaleString()}</div>
            <div className="card-label">Total Runs</div>
          </div>
          <div className="card">
            <div className="card-val">{fmtTokens(totalTokens)}</div>
            <div className="card-label">Total Tokens</div>
          </div>
          <div className="card">
            <div className="card-val">{fmtUsd(summary?.totalCostUsd)}</div>
            <div className="card-label">Total Cost (USD)</div>
          </div>
          <div className="card">
            <div className="card-val">{fmtUsd(summary?.avgCostPerRun)}</div>
            <div className="card-label">Avg Cost / Run</div>
          </div>
        </div>

        {/* By Project */}
        <div className="section-label">By Project</div>
        <div className="table-wrap">
          {(!summary?.byProject?.length) ? (
            <div className="empty">No project usage data yet. Start a workflow to see data here.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Runs</th>
                  <th>Input Tokens</th>
                  <th>Output Tokens</th>
                  <th>Total Cost</th>
                  <th>Avg Cost / Run</th>
                </tr>
              </thead>
              <tbody>
                {summary.byProject.map(p => (
                  <tr key={p.projectId}>
                    <td style={{ fontWeight:600 }}>{p.projectName}</td>
                    <td>{p.runs}</td>
                    <td>{fmtTokens(p.inputTokens)}</td>
                    <td>{fmtTokens(p.outputTokens)}</td>
                    <td>{fmtUsd(p.costUsd)}</td>
                    <td>{fmtUsd(p.avgCostPerRun)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Runs */}
        <div className="section-label">Recent Runs</div>
        <div className="table-wrap">
          {runs.length === 0 ? (
            <div className="empty">
              <div style={{ fontSize:36, marginBottom:12 }}>📊</div>
              No runs yet. Start a workflow to see usage here.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Steps</th>
                  <th>Input Tokens</th>
                  <th>Output Tokens</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.runId}>
                    <td style={{ color:'var(--text3)', whiteSpace:'nowrap' }}>{fmtDate(r.startedAt)}</td>
                    <td style={{ fontWeight:600 }}>{r.projectName}</td>
                    <td><StatusPill status={r.status} /></td>
                    <td>{r.stepsCount}</td>
                    <td>{fmtTokens(r.inputTokens)}</td>
                    <td>{fmtTokens(r.outputTokens)}</td>
                    <td>{fmtUsd(r.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </>
  );
}
