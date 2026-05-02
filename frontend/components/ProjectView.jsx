import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext.jsx';
import AgentConfig from './AgentConfig.jsx';
import WorkflowRunner from './WorkflowRunner.jsx';
import { Spinner, Alert, Badge, getAgentType, FormGroup } from './UI.jsx';
import * as api from '../client.js';

const TABS = ['Overview', 'Agents', 'Integrations', 'Runs'];

export default function ProjectView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { loadProject, loadRuns, updateProject, runs, loading, currentProject } = useApp();

  const [tab, setTab] = useState('Overview');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [connStatus, setConnStatus] = useState({ github: 'idle', jira: 'idle', confluence: 'idle' });

  useEffect(() => {
    loadProject(id).catch(() => navigate('/'));
    loadRuns(id);
  }, [id]);

  const project = currentProject?.id === id ? currentProject : null;

  if (loading.project && !project) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!project) return null;

  const sortedAgents = [...(project.agents || [])].sort((a, b) => a.order - b.order);
  const lastRun = runs[0];

  function statusVariant(s) {
    return { ready: 'ready', draft: 'draft', running: 'running', completed: 'done' }[s] || 'pending';
  }

  function startEditSettings() {
    setEditForm({
      name: project.name,
      description: project.description,
      git: { ...project.git },
      jira: { ...project.jira },
      confluence: { ...project.confluence }
    });
    setEditMode(true);
  }

  function setField(path, value) {
    setEditForm(prev => {
      const parts = path.split('.');
      if (parts.length === 1) return { ...prev, [path]: value };
      return { ...prev, [parts[0]]: { ...prev[parts[0]], [parts[1]]: value } };
    });
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      await updateProject(id, editForm);
      setEditMode(false);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  }

  async function testConn(type) {
    setConnStatus(prev => ({ ...prev, [type]: 'testing' }));
    try {
      const result = await api.testConnection(id, type);
      setConnStatus(prev => ({ ...prev, [type]: result.success ? 'ok' : 'error' }));
    } catch {
      setConnStatus(prev => ({ ...prev, [type]: 'error' }));
    }
  }

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function runStatusColor(s) {
    return { completed: 'var(--success)', failed: 'var(--danger)', running: 'var(--info)' }[s] || 'var(--text-muted)';
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="page-title">{project.name}</span>
              <Badge
                label={project.status === 'ready' ? '✓ Ready' : project.status === 'draft' ? '○ Draft' : project.status}
                variant={statusVariant(project.status)}
              />
            </div>
            {project.description && (
              <div className="page-subtitle">{project.description}</div>
            )}
          </div>
        </div>
        <WorkflowRunner project={project} onRunComplete={() => loadRuns(id)} />
      </div>

      {/* ── Readiness Alert ── */}
      {project.status === 'draft' && (
        <Alert type="warning">
          Project is in <strong>Draft</strong> status. Configure all agents and connect Jira to enable execution.
        </Alert>
      )}

      {/* ── Tabs ── */}
      <div className="tabs" style={{ marginTop: 16 }}>
        {TABS.map(t => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'Overview' && '⬡ '}
            {t === 'Agents' && `🤖 `}
            {t === 'Integrations' && '🔌 '}
            {t === 'Runs' && '▶ '}
            {t}
            {t === 'Agents' && ` (${sortedAgents.length})`}
            {t === 'Runs' && runs.length > 0 && ` (${runs.length})`}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'Overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Pipeline summary */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Pipeline Configuration</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setTab('Agents')}>
                Configure →
              </button>
            </div>
            {sortedAgents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                No agents configured yet
              </div>
            ) : (
              <div className="pipeline">
                {sortedAgents.map((agent, i) => {
                  const at = getAgentType(agent.type);
                  return (
                    <React.Fragment key={agent.id}>
                      {i > 0 && <div className="pipeline-arrow">→</div>}
                      <div className="pipeline-step">
                        <div className={`pipeline-node ${agent.type.replace('-agent', '')}`}>
                          <div className="pipeline-node-icon">{at.icon}</div>
                          <div className="pipeline-node-name">{agent.name}</div>
                          <div className="pipeline-node-type">{at.label}</div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>

          {/* Last Run Summary */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Last Execution</div>
              {runs.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => setTab('Runs')}>
                  All Runs →
                </button>
              )}
            </div>
            {!lastRun ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                No runs yet. Execute a workflow to see results here.
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {lastRun.jiraStory}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {formatDate(lastRun.startedAt)}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: runStatusColor(lastRun.status)
                  }}>
                    {lastRun.status === 'completed' ? '✓ Completed' :
                     lastRun.status === 'failed' ? '✗ Failed' : lastRun.status}
                  </span>
                </div>
                <div>
                  {lastRun.steps?.map(step => {
                    const at = getAgentType(step.agentType);
                    return (
                      <div key={step.agentId} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 0', fontSize: 12, borderBottom: '1px solid var(--border-subtle)'
                      }}>
                        <span>{at.icon}</span>
                        <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{step.agentName}</span>
                        <span style={{ color: runStatusColor(step.status), fontWeight: 600, fontSize: 11 }}>
                          {step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : '○'} {step.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Integrations Status */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Integrations</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setTab('Integrations')}>
                Configure →
              </button>
            </div>
            <IntegrationStatus label="Git Repository" icon="⬡"
              configured={!!(project.git?.owner && project.git?.repo)}
              detail={project.git?.owner ? `${project.git.owner}/${project.git.repo}` : 'Not configured'} />
            <IntegrationStatus label="Jira" icon="📋"
              configured={!!(project.jira?.url)}
              detail={project.jira?.url ? `${project.jira.projectKey || 'No project key'}` : 'Not configured'} />
            <IntegrationStatus label="Confluence" icon="📄"
              configured={!!(project.confluence?.url)}
              detail={project.confluence?.url ? `Space: ${project.confluence.spaceKey || 'Not set'}` : 'Not configured'} />
          </div>

          {/* Quick Stats */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Statistics</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <StatBox label="Agents" value={sortedAgents.length} />
              <StatBox label="Total Runs" value={runs.length} />
              <StatBox label="Successful" value={runs.filter(r => r.status === 'completed').length} color="var(--success)" />
              <StatBox label="Failed" value={runs.filter(r => r.status === 'failed').length} color="var(--danger)" />
            </div>
          </div>
        </div>
      )}

      {/* ── Agents Tab ── */}
      {tab === 'Agents' && (
        <AgentConfig project={project} onDone={() => loadProject(id)} />
      )}

      {/* ── Integrations Tab ── */}
      {tab === 'Integrations' && (
        <div>
          {!editMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <IntegrationCard
                title="Git Repository"
                icon="⬡"
                fields={[
                  { label: 'Repo URL', value: project.git?.repoUrl },
                  { label: 'Owner', value: project.git?.owner },
                  { label: 'Repo', value: project.git?.repo },
                  { label: 'Branch', value: project.git?.branch },
                  { label: 'Token', value: project.git?.token ? '••••••••' : '' }
                ]}
                connStatus={connStatus.github}
                onTest={() => testConn('github')}
                onEdit={startEditSettings}
              />
              <IntegrationCard
                title="Jira"
                icon="📋"
                fields={[
                  { label: 'URL', value: project.jira?.url },
                  { label: 'Email', value: project.jira?.email },
                  { label: 'Project Key', value: project.jira?.projectKey },
                  { label: 'Token', value: project.jira?.token ? '••••••••' : '' }
                ]}
                connStatus={connStatus.jira}
                onTest={() => testConn('jira')}
                onEdit={startEditSettings}
              />
              <IntegrationCard
                title="Confluence"
                icon="📄"
                fields={[
                  { label: 'URL', value: project.confluence?.url },
                  { label: 'Email', value: project.confluence?.email },
                  { label: 'Space Key', value: project.confluence?.spaceKey },
                  { label: 'Token', value: project.confluence?.token ? '••••••••' : '' }
                ]}
                connStatus={connStatus.confluence}
                onTest={() => testConn('confluence')}
                onEdit={startEditSettings}
              />
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Edit Project Settings</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditMode(false)}>Cancel</button>
                  <button className="btn btn-primary btn-sm" onClick={saveSettings} disabled={savingSettings}>
                    {savingSettings ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              <FormGroup label="Project Name">
                <input className="form-input" value={editForm.name || ''}
                  onChange={e => setField('name', e.target.value)} />
              </FormGroup>
              <FormGroup label="Description">
                <textarea className="form-textarea" value={editForm.description || ''}
                  onChange={e => setField('description', e.target.value)} rows={2} />
              </FormGroup>

              <div className="divider" />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Git Repository</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormGroup label="Owner"><input className="form-input" value={editForm.git?.owner || ''} onChange={e => setField('git.owner', e.target.value)} /></FormGroup>
                <FormGroup label="Repo"><input className="form-input" value={editForm.git?.repo || ''} onChange={e => setField('git.repo', e.target.value)} /></FormGroup>
                <FormGroup label="Branch"><input className="form-input" value={editForm.git?.branch || ''} onChange={e => setField('git.branch', e.target.value)} /></FormGroup>
                <FormGroup label="Token"><input className="form-input" type="password" value={editForm.git?.token || ''} onChange={e => setField('git.token', e.target.value)} /></FormGroup>
              </div>

              <div className="divider" />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Jira</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormGroup label="URL"><input className="form-input" value={editForm.jira?.url || ''} onChange={e => setField('jira.url', e.target.value)} /></FormGroup>
                <FormGroup label="Email"><input className="form-input" value={editForm.jira?.email || ''} onChange={e => setField('jira.email', e.target.value)} /></FormGroup>
                <FormGroup label="Project Key"><input className="form-input" value={editForm.jira?.projectKey || ''} onChange={e => setField('jira.projectKey', e.target.value)} /></FormGroup>
                <FormGroup label="Token"><input className="form-input" type="password" value={editForm.jira?.token || ''} onChange={e => setField('jira.token', e.target.value)} /></FormGroup>
              </div>

              <div className="divider" />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Confluence</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormGroup label="URL"><input className="form-input" value={editForm.confluence?.url || ''} onChange={e => setField('confluence.url', e.target.value)} /></FormGroup>
                <FormGroup label="Email"><input className="form-input" value={editForm.confluence?.email || ''} onChange={e => setField('confluence.email', e.target.value)} /></FormGroup>
                <FormGroup label="Space Key"><input className="form-input" value={editForm.confluence?.spaceKey || ''} onChange={e => setField('confluence.spaceKey', e.target.value)} /></FormGroup>
                <FormGroup label="Token"><input className="form-input" type="password" value={editForm.confluence?.token || ''} onChange={e => setField('confluence.token', e.target.value)} /></FormGroup>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Runs Tab ── */}
      {tab === 'Runs' && (
        <div>
          {loading.runs && runs.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <Spinner size="lg" />
            </div>
          ) : runs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>▶</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                No runs yet
              </div>
              <div style={{ fontSize: 13 }}>
                Click "Run Workflow" to start your first pipeline execution
              </div>
            </div>
          ) : (
            <div className="runs-list">
              {runs.map(run => (
                <RunItem key={run.id} run={run} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function IntegrationStatus({ label, icon, configured, detail }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 13 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ flex: 1, color: 'var(--text-primary)' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{detail}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: configured ? 'var(--success)' : 'var(--warning)' }}>
        {configured ? '✓ Set' : '○ Not set'}
      </span>
    </div>
  );
}

function IntegrationCard({ title, icon, fields, connStatus, onTest, onEdit }) {
  const connColor = { ok: 'var(--success)', error: 'var(--danger)', testing: 'var(--info)', idle: 'var(--text-muted)' }[connStatus];
  const connLabel = { ok: '✓ Connected', error: '✗ Failed', testing: 'Testing...', idle: 'Not tested' }[connStatus];

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div className="card-title">{title}</div>
          <span style={{ fontSize: 11, fontWeight: 600, color: connColor }}>{connLabel}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={onTest}>
            {connStatus === 'testing' ? '⟳ Testing' : '⟳ Test Connection'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onEdit}>✏️ Edit</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {fields.map(f => (
          <div key={f.label}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{f.label}</div>
            <div style={{ fontSize: 12, color: f.value ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: f.value?.startsWith('•') ? 'monospace' : 'inherit' }}>
              {f.value || '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '12px', textAlign: 'center'
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function RunItem({ run }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = { completed: 'var(--success)', failed: 'var(--danger)', running: 'var(--info)' }[run.status] || 'var(--text-muted)';

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function duration(start, end) {
    if (!start || !end) return '';
    const s = Math.round((new Date(end) - new Date(start)) / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{run.jiraStory}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: statusColor }}>
          {run.status === 'completed' ? '✓ Completed' : run.status === 'failed' ? '✗ Failed' : run.status}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(run.startedAt)}</span>
        {run.completedAt && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⏱ {duration(run.startedAt, run.completedAt)}</span>}
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {run.steps?.map(step => {
            const at = getAgentType(step.agentType);
            return (
              <StepDetail key={step.agentId} step={step} at={at} />
            );
          })}
          {run.error && (
            <div style={{ padding: '12px 16px', background: 'var(--danger-bg)', borderTop: '1px solid var(--danger-border)', color: 'var(--danger)', fontSize: 12 }}>
              Error: {run.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepDetail({ step, at }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = { completed: 'var(--success)', failed: 'var(--danger)', running: 'var(--info)', pending: 'var(--text-muted)' }[step.status];

  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div
        style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, cursor: step.output ? 'pointer' : 'default' }}
        onClick={() => step.output && setExpanded(e => !e)}
      >
        <span>{at.icon}</span>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{step.agentName}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>
          {step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : '○'} {step.status}
        </span>
        {step.output && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</span>}
      </div>
      {expanded && step.output && (
        <div style={{ padding: '10px 16px 14px', background: 'var(--bg-primary)' }}>
          <div className="step-output-text">{step.output}</div>
        </div>
      )}
      {step.error && (
        <div style={{ padding: '6px 16px', fontSize: 11, color: 'var(--danger)' }}>
          {step.error}
        </div>
      )}
    </div>
  );
}
