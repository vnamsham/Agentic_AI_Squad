import React, { useState, useEffect } from 'react';

import UsageDashboard from './UsageDashboard.jsx';
import { useApp } from '../AppContext.jsx';
import { Btn, Modal, ModalHeader, ModalBody, ModalFooter, SectionLabel, Tag, fmtDateTime, getAgentMeta } from './UI.jsx';
import * as api from '../client.js';

// ─── Add Story Modal ──────────────────────────────────────────────────────────

function AddStoryModal({ project, onClose }) {
  const { actions } = useApp();
  const [mode, setMode] = useState('manual'); // manual | jira
  const [form, setForm] = useState({ key: '', summary: '', description: '' });
  const [jiraStories, setJiraStories] = useState([]);
  const [loadingJira, setLoadingJira] = useState(false);
  const [selectedJira, setSelectedJira] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadJiraStories() {
    setLoadingJira(true);
    setError('');
    try {
      const stories = await api.getJiraStories(project.id);
      setJiraStories(stories);
    } catch (e) {
      setError('Failed to fetch Jira stories: ' + e.message);
    } finally {
      setLoadingJira(false);
    }
  }

  useEffect(() => {
    if (mode === 'jira') loadJiraStories();
  }, [mode]);

  async function handleSave() {
    const story = mode === 'manual'
      ? { key: form.key.trim(), summary: form.summary.trim(), description: form.description.trim(), source: 'manual' }
      : selectedJira;

    if (!story?.key || !story?.summary) {
      setError('Story key and summary are required');
      return;
    }
    setSaving(true);
    try {
      await actions.addStory(project.id, story);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} width={580}>
      <ModalHeader
        title="Add Story"
        subtitle="Add a Jira story to this project's workflow queue"
        onClose={onClose}
      />
      <ModalBody>
        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', padding: 3 }}>
          {[
            { id: 'manual', label: '✏️ Manual Entry' },
            { id: 'jira',   label: '📋 From Jira' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setError(''); }}
              style={{
                flex: 1, padding: '7px 12px', border: 'none', borderRadius: 6,
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)', cursor: 'pointer',
                transition: 'all .15s',
                background: mode === m.id ? 'var(--surface)' : 'transparent',
                color: mode === m.id ? 'var(--accent)' : 'var(--text3)',
                boxShadow: mode === m.id ? 'var(--shadow)' : 'none',
              }}
            >{m.label}</button>
          ))}
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 'var(--radius-sm)', color: 'var(--red)', fontSize: 12, marginBottom: 14 }}>
            {error}
          </div>
        )}

        {mode === 'manual' && (
          <>
            <div className="form-group">
              <label>Story Key *</label>
              <input value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
                placeholder="e.g. PROJ-123, GATEWAY-456" autoFocus />
            </div>
            <div className="form-group">
              <label>Summary *</label>
              <input value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                placeholder="Brief description of the story" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional: additional context for agents..." style={{ resize: 'none' }} />
            </div>
          </>
        )}

        {mode === 'jira' && (
          <>
            {!project.jira?.url && (
              <div style={{ padding: '12px', background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', borderRadius: 'var(--radius-sm)', color: 'var(--amber)', fontSize: 12 }}>
                ⚠️ Jira is not configured for this project. Go to the project settings to add your Jira credentials.
              </div>
            )}

            {project.jira?.url && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {loadingJira ? 'Fetching stories from Jira…' : `${jiraStories.length} open stories in ${project.jira.projectKey || 'project'}`}
                  </span>
                  <Btn small onClick={loadJiraStories} disabled={loadingJira}>
                    {loadingJira ? '⟳ Loading…' : '⟳ Refresh'}
                  </Btn>
                </div>

                {loadingJira && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                    <span className="spinner spinner-lg" />
                  </div>
                )}

                {!loadingJira && jiraStories.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13 }}>
                    No open stories found in the current sprint
                  </div>
                )}

                {!loadingJira && jiraStories.map(story => (
                  <div
                    key={story.key}
                    onClick={() => setSelectedJira(story)}
                    style={{
                      padding: '10px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      border: `1px solid ${selectedJira?.key === story.key ? 'var(--accent)' : 'var(--border2)'}`,
                      background: selectedJira?.key === story.key ? 'var(--accent-bg)' : 'var(--surface)',
                      marginBottom: 8, transition: 'all .12s',
                    }}
                    onMouseEnter={e => { if (selectedJira?.key !== story.key) e.currentTarget.style.background = 'var(--surface2)'; }}
                    onMouseLeave={e => { if (selectedJira?.key !== story.key) e.currentTarget.style.background = 'var(--surface)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{story.key}</span>
                      {story.priority && <span className="tag tag-accent" style={{ fontSize: 10 }}>{story.priority}</span>}
                      {story.status && <span className="tag tag-pending" style={{ fontSize: 10 }}>{story.status}</span>}
                      {selectedJira?.key === story.key && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontWeight: 700, fontSize: 12 }}>✓</span>}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{story.summary}</div>
                    {story.assignee && <div style={{ fontSize: 11, color: 'var(--text4)' }}>Assignee: {story.assignee}</div>}
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Btn onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn primary onClick={handleSave} disabled={saving || (mode === 'jira' && !selectedJira)}>
          {saving ? 'Adding…' : 'Add Story'}
        </Btn>
      </ModalFooter>
    </Modal>
  );
}

// ─── Main Workflow Page ───────────────────────────────────────────────────────

export default function Workflow() {
  const { state, actions } = useApp();
  const [showAddStory, setShowAddStory] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const project = state.projects.find(p => p.id === state.activeProjectId);
  if (!project) return null;

  const stories = project.stories || [];
  const sortedAgents = [...(project.agents || [])].sort((a, b) => a.order - b.order);
  const isReady = project.status === 'ready';

  async function handleDeleteStory(storyId) {
    try {
      await actions.deleteStory(project.id, storyId);
      setDeleteTarget(null);
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  }

  return (
    <>
      {showAddStory && <AddStoryModal project={project} onClose={() => setShowAddStory(false)} />}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} width={400}>
          <ModalHeader title="Remove Story" onClose={() => setDeleteTarget(null)} />
          <ModalBody>
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>
              Remove <strong>{deleteTarget.key}</strong> from the workflow queue?
            </p>
          </ModalBody>
          <ModalFooter>
            <Btn onClick={() => setDeleteTarget(null)}>Cancel</Btn>
            <Btn danger onClick={() => handleDeleteStory(deleteTarget.id)}>Remove</Btn>
          </ModalFooter>
        </Modal>
      )}

      <div className="page-with-sidebar">
        <div className="page-main">
          {/* Page header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <button
                  onClick={() => actions.setPage('dashboard')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--font)', padding: 0 }}
                >
                  Dashboard
                </button>
                <span style={{ color: 'var(--text4)', fontSize: 12 }}>›</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{project.name}</span>
              </div>
              <h1>Workflow</h1>
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>
                Manage stories and run the agent pipeline
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={() => actions.setPage('agents')}>⚙ Manage Agents</Btn>
              <Btn primary onClick={() => setShowAddStory(true)}>+ Add Story</Btn>
            </div>
          </div>

          {/* Readiness check */}
          {!isReady && (
            <div style={{
              padding: '12px 16px', background: 'var(--amber-bg)', border: '1px solid var(--amber-border)',
              borderRadius: 'var(--radius)', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)', marginBottom: 3 }}>Project not ready to run</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {sortedAgents.length === 0 ? (
                    <>No agents configured. <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, padding: 0, fontWeight: 600 }} onClick={() => actions.setPage('agents')}>Add agents →</button></>
                  ) : !project.jira?.url ? (
                    'Jira is not connected. Configure integrations to enable story fetching.'
                  ) : (
                    'Some configuration is missing. Check agents and integrations.'
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Pipeline preview */}
          {sortedAgents.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionLabel>Agent Pipeline</SectionLabel>
              <div className="pipeline-bar">
                {sortedAgents.map((agent, i) => {
                  const meta = getAgentMeta(agent.type);
                  return (
                    <React.Fragment key={agent.id}>
                      {i > 0 && <div className="pipeline-arrow">→</div>}
                      <div className="pipeline-node pending" style={{ background: 'transparent' }}>
                        <div className="pipeline-node-icon">{meta.icon}</div>
                        <div className="pipeline-node-name">{agent.name}</div>
                        <div className={`tag tag-${meta.color}`} style={{ fontSize: 10, marginTop: 2 }}>{meta.label}</div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stories */}
          <SectionLabel>Stories — {stories.length}</SectionLabel>

          {stories.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📋</div>
              <h3 style={{ marginBottom: 8 }}>No stories yet</h3>
              <p style={{ fontSize: 13, marginBottom: 20 }}>
                Add stories manually or import from Jira to start running the agent workflow
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <Btn onClick={() => setShowAddStory(true)}>✏️ Manual Entry</Btn>
                <Btn primary onClick={() => setShowAddStory(true)}>📋 From Jira</Btn>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '130px 1fr 100px 130px 120px',
                padding: '8px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border2)',
              }}>
                {['Story Key', 'Summary', 'Source', 'Added', 'Actions'].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                ))}
              </div>

              {stories.map((story, i) => (
                <StoryRow
                  key={story.id}
                  story={story}
                  project={project}
                  isReady={isReady}
                  isLast={i === stories.length - 1}
                  onDelete={() => setDeleteTarget(story)}
                  onRun={() => actions.openAgentStudio(story)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="page-sidebar">
          <WorkflowSidebar project={project} stories={stories} sortedAgents={sortedAgents} />
        </div>
      </div>
    </>
  );
}

function StoryRow({ story, project, isReady, isLast, onDelete, onRun }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid', gridTemplateColumns: '130px 1fr 100px 130px 120px',
        padding: '12px 16px', alignItems: 'center',
        borderBottom: isLast ? 'none' : '1px solid var(--border2)',
        background: hovered ? 'var(--surface2)' : 'transparent',
        transition: 'background .12s',
      }}
    >
      <div>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700,
          color: 'var(--accent)', background: 'var(--accent-bg)',
          padding: '2px 8px', borderRadius: 4, border: '1px solid var(--accent-border)',
        }}>{story.key}</span>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2, paddingRight: 12 }}>
          {story.summary}
        </div>
        {story.description && (
          <div style={{ fontSize: 11, color: 'var(--text4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>
            {story.description}
          </div>
        )}
      </div>

      <div>
        <span className={`tag ${story.source === 'jira' ? 'tag-accent' : 'tag-pending'}`}>
          {story.source === 'jira' ? '📋 Jira' : '✏️ Manual'}
        </span>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text4)' }}>
        {fmtDateTime(story.addedAt)}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <Btn
          primary small
          onClick={onRun}
          disabled={!isReady}
          title={!isReady ? 'Configure all agents first' : 'Run agent workflow for this story'}
        >
          ▶ Run
        </Btn>
        <button
          onClick={onDelete}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text4)', fontSize: 14, padding: '2px 6px', borderRadius: 4 }}
          title="Remove story"
        >✕</button>
      </div>
    </div>
  );
}

function WorkflowSidebar({ project, stories, sortedAgents }) {
  const { actions } = useApp();
  const [connStatus, setConnStatus] = useState({ github: 'idle', jira: 'idle', confluence: 'idle' });

  async function testConn(type) {
    setConnStatus(prev => ({ ...prev, [type]: 'testing' }));
    try {
      const r = await api.testConnection(project.id, type);
      setConnStatus(prev => ({ ...prev, [type]: r.success ? 'ok' : 'error' }));
    } catch {
      setConnStatus(prev => ({ ...prev, [type]: 'error' }));
    }
  }

  const connDot = (s) => ({
    ok: '🟢', error: '🔴', testing: '🟡', idle: '⚪'
  })[s] || '⚪';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Project Status */}
      <div className="sidebar-card">
        <div className="sidebar-card-header" style={{ cursor: 'default' }}>
          <span className="sidebar-card-title">Project Status</span>
        </div>
        <div style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Status</span>
            <span className={`tag tag-${project.status === 'ready' ? 'ready' : 'draft'}`}>
              {project.status === 'ready' ? '✓ Ready' : '○ Draft'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Agents</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: sortedAgents.length > 0 ? 'var(--green)' : 'var(--red)' }}>
              {sortedAgents.length} configured
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Stories</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{stories.length} queued</span>
          </div>
          <Btn small onClick={() => actions.setPage('agents')} style={{ width: '100%', justifyContent: 'center' }}>
            ⚙ Configure Agents
          </Btn>
        </div>
      </div>

      {/* Integrations */}
      <div className="sidebar-card">
        <div className="sidebar-card-header" style={{ cursor: 'default' }}>
          <span className="sidebar-card-title">Integrations</span>
        </div>
        <div style={{ padding: '8px 0' }}>
          {[
            { id: 'jira',       label: 'Jira',        configured: !!(project.jira?.url),       detail: project.jira?.projectKey },
            { id: 'github',     label: 'Git Repo',    configured: !!(project.git?.owner),      detail: project.git?.repo },
            { id: 'confluence', label: 'Confluence',  configured: !!(project.confluence?.url), detail: project.confluence?.spaceKey },
          ].map(conn => (
            <div key={conn.id} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border2)' }}>
              <span style={{ fontSize: 12 }}>{connDot(connStatus[conn.id] !== 'idle' ? connStatus[conn.id] : conn.configured ? 'ok' : 'error')}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{conn.label}</div>
                {conn.detail && <div style={{ fontSize: 10, color: 'var(--text4)' }}>{conn.detail}</div>}
              </div>
              <button
                onClick={() => testConn(conn.id)}
                disabled={!conn.configured}
                style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', cursor: conn.configured ? 'pointer' : 'not-allowed', fontSize: 10, fontWeight: 600, padding: '2px 8px', color: 'var(--text3)', fontFamily: 'var(--font)', opacity: conn.configured ? 1 : 0.4 }}
              >
                {connStatus[conn.id] === 'testing' ? '⟳' : 'Test'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="sidebar-card">
        <div className="sidebar-card-header" style={{ cursor: 'default' }}>
          <span className="sidebar-card-title">How It Works</span>
        </div>
        <div style={{ padding: '12px 16px' }}>
          {[
            { step: '1', text: 'Add a Jira story to the queue' },
            { step: '2', text: 'Click "Run" to start the agent pipeline' },
            { step: '3', text: 'Lead Agent reads & plans the work' },
            { step: '4', text: 'Developer Agent writes the code' },
            { step: '5', text: 'Tester Agent validates the changes' },
            { step: '6', text: 'Regression Agent confirms no breakage' },
            { step: '7', text: 'Lead Agent raises a Pull Request' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', color: '#fff',
                fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
              }}>{s.step}</div>
              <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>{s.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
