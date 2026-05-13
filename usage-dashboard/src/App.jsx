import React, { useState, useEffect, useCallback } from 'react';
import { getUsage, getProjects } from './client.js';
import SummaryCards from './components/SummaryCards.jsx';
import RunsTable from './components/RunsTable.jsx';
import ProjectFilter from './components/ProjectFilter.jsx';

export default function App() {
  const [runs, setRuns]             = useState([]);
  const [aggregate, setAggregate]   = useState(null);
  const [projects, setProjects]     = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [from, setFrom]             = useState('');
  const [to, setTo]                 = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  // Load project list once
  useEffect(() => {
    getProjects().then(setProjects).catch(() => {});
  }, []);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsage({
        projectId: selectedProject || undefined,
        from: from || undefined,
        to:   to   || undefined,
      });
      setRuns(data.runs || []);
      setAggregate(data.aggregate || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProject, from, to]);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>📊 Usage &amp; Cost Dashboard</h1>
        <p>Anthropic API token consumption and estimated cost per pipeline run and agent step.</p>
      </div>

      {/* Filters */}
      <div className="filters">
        <ProjectFilter
          projects={projects}
          value={selectedProject}
          onChange={setSelectedProject}
        />
        <input
          type="date"
          className="input"
          value={from}
          onChange={e => setFrom(e.target.value)}
          title="From date"
          style={{ width: 150 }}
        />
        <span style={{ color: 'var(--text4)', fontSize: 12 }}>→</span>
        <input
          type="date"
          className="input"
          value={to}
          onChange={e => setTo(e.target.value)}
          title="To date"
          style={{ width: 150 }}
        />
        <button
          className="input"
          onClick={fetchUsage}
          style={{ cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0 16px', fontWeight: 600, fontSize: 12 }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', marginBottom: 16, fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      <SummaryCards aggregate={aggregate} loading={loading} />
      <RunsTable runs={runs} loading={loading} />
    </div>
  );
}
