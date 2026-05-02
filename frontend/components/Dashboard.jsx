import React, { useState } from 'react';
import { useApp } from '../AppContext.jsx';
import { Btn, Modal, ModalHeader, ModalBody, ModalFooter, SectionLabel, ProgressBar, Tag, fmtDate, getAgentMeta } from './UI.jsx';

const ACCENT = '#2563EB'; /* was '#A100FF' */

function NewProjectModal({ onClose }) {
  const { actions } = useApp();
  const [form, setForm] = useState({
    name: '', description: '',
    git: { repoUrl: '', owner: '', repo: '', branch: 'main', token: '' },
    jira: { url: '', email: '', token: '', projectKey: '' },
    confluence: { url: '', email: '', token: '', spaceKey: '' },
  });
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);

  function setNested(path, value) {
    setForm(f => {
      const [k1, k2] = path.split('.');
      if (!k2) return { ...f, [k1]: value };
      return { ...f, [k1]: { ...f[k1], [k2]: value } };
    });
  }

  function inp(label, path, type = 'text', ph = '') {
    const [k1, k2] = path.split('.');
    const val = k2 ? form[k1][k2] : form[path];
    return (
      <div className="form-group" style={{ marginBottom: 14 }}>
        <label>{label}</label>
        <input
          type={type} placeholder={ph || label} value={val}
          style={{ borderColor: path === 'name' && nameError ? 'var(--red)' : undefined }}
          onChange={e => { setNested(path, e.target.value); if (path === 'name') setNameError(false); }}
        />
      </div>
    );
  }

  async function handleCreate() {
    if (!form.name.trim()) { setNameError(true); return; }
    setSaving(true);
    try {
      const project = await actions.createProject(form);
      actions.setProject(project.id);
      onClose();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  const steps = ['Project Info', 'Git Repository', 'Jira', 'Confluence'];

  return (
    <Modal onClose={onClose} width={560}>
      <ModalHeader
        title="New Project"
        subtitle="Set up your project to start running AI agents"
        onClose={onClose}
      />
      <ModalBody>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center', padding: '5px 4px', borderRadius: 6,
              background: step === i + 1 ? 'var(--accent-bg)' : step > i + 1 ? 'var(--green-bg)' : 'var(--bg2)',
              border: `1px solid ${step === i + 1 ? 'var(--accent-border)' : step > i + 1 ? 'var(--green-border)' : 'var(--border2)'}`,
              color: step === i + 1 ? 'var(--accent)' : step > i + 1 ? 'var(--green)' : 'var(--text4)',
              fontSize: 11, fontWeight: 700, cursor: step > i + 1 ? 'pointer' : 'default',
            }}
              onClick={() => step > i + 1 && setStep(i + 1)}
            >
              {step > i + 1 ? '✓ ' : ''}{s}
            </div>
          ))}
        </div>

        {step === 1 && (
          <>
            {inp('Project Name *', 'name', 'text', 'e.g. Gateway Pro, Payment Service')}
            <div className="form-group">
              <label>Description</label>
              <textarea rows={3} placeholder="Brief description…" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'none' }} />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ padding: '10px 12px', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
              Connect to your Git repository so agents can read code and create branches/PRs.
            </div>
            {inp('Repository URL', 'git.repoUrl', 'text', 'https://github.com/org/repo')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {inp('Owner / Org', 'git.owner', 'text', 'your-org')}
              {inp('Repository', 'git.repo', 'text', 'your-repo')}
              {inp('Default Branch', 'git.branch', 'text', 'main')}
              {inp('Personal Access Token', 'git.token', 'password', 'ghp_...')}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ padding: '10px 12px', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
              Connect Jira so agents can read stories and requirements. Story key is entered at run time.
            </div>
            {inp('Jira URL', 'jira.url', 'text', 'https://yourcompany.atlassian.net')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {inp('Email', 'jira.email', 'email', 'you@company.com')}
              {inp('API Token', 'jira.token', 'password', 'Your Jira API token')}
              {inp('Project Key', 'jira.projectKey', 'text', 'PROJ')}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div style={{ padding: '10px 12px', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
              Connect Confluence so the Lead Agent can read your business and technical documentation.
            </div>
            {inp('Confluence URL', 'confluence.url', 'text', 'https://yourcompany.atlassian.net/wiki')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {inp('Email', 'confluence.email', 'email', 'you@company.com')}
              {inp('API Token', 'confluence.token', 'password', 'Your Confluence token')}
              {inp('Space Key', 'confluence.spaceKey', 'text', 'TECH')}
            </div>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Btn onClick={onClose} disabled={saving}>Cancel</Btn>
        {step > 1 && <Btn onClick={() => setStep(s => s - 1)} disabled={saving}>← Back</Btn>}
        {step < 4
          ? <Btn primary onClick={() => { if (step === 1 && !form.name.trim()) { setNameError(true); return; } setStep(s => s + 1); }}>Next →</Btn>
          : <Btn primary onClick={handleCreate} disabled={saving}>{saving ? 'Creating…' : 'Create Project'}</Btn>
        }
      </ModalFooter>
    </Modal>
  );
}

function ProjectCard({ proj }) {
  const { actions } = useApp();
  const [hovered, setHovered] = useState(false);
  const sortedAgents = [...(proj.agents || [])].sort((a, b) => a.order - b.order);
  const stories = proj.stories || [];
  const pct = proj.status === 'ready' ? 100 : proj.status === 'draft' ? 25 : 50;

  return (
    <div
      onClick={() => { actions.setProject(proj.id); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface)', border: `1px solid ${hovered ? 'var(--border)' : 'var(--border2)'}`,
        borderRadius: 'var(--radius-lg)', overflow: 'hidden', cursor: 'pointer',
        boxShadow: hovered ? 'var(--shadow-lg)' : 'var(--shadow)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all .2s', display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Top accent strip */}
      <div style={{ height: 4, background: 'linear-gradient(90deg, #2563EB, #60A5FA)', flexShrink: 0 }} /> {/* was #A100FF, #C840FF */}

      <div style={{ padding: '14px 16px 10px', flex: 1 }}>
        {/* Controls */}
        <div style={{ position: 'absolute', top: 14, right: 8, display: 'flex', gap: 2, opacity: hovered ? 1 : 0, transition: 'opacity .15s' }}>
          <button
            onClick={e => { e.stopPropagation(); if (confirm(`Delete "${proj.name}"?`)) actions.deleteProject(proj.id); }}
            style={{ background: 'transparent', border: 'none', color: 'var(--text4)', fontSize: 13, cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}>✕</button>
        </div>

        {/* Tags row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <span className={`tag tag-${proj.status === 'ready' ? 'ready' : 'draft'}`}>
            {proj.status === 'ready' ? '✓ Ready' : '○ Draft'}
          </span>
          {sortedAgents.length > 0 && (
            <span className="tag tag-accent">{sortedAgents.length} agent{sortedAgents.length !== 1 ? 's' : ''}</span>
          )}
          {stories.length > 0 && (
            <span className="tag tag-accent">{stories.length} stor{stories.length !== 1 ? 'ies' : 'y'}</span>
          )}
        </div>

        {/* Name */}
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6, lineHeight: 1.3, paddingRight: 20 }}>
          {proj.name}
        </div>

        {/* Description */}
        {proj.description && (
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {proj.description}
          </div>
        )}

        {/* Agent pipeline preview */}
        {sortedAgents.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            {sortedAgents.map((a, i) => {
              const meta = getAgentMeta(a.type);
              return (
                <React.Fragment key={a.id}>
                  {i > 0 && <span style={{ color: 'var(--text4)', fontSize: 10, alignSelf: 'center' }}>→</span>}
                  <span className={`tag tag-${meta.color}`}>{meta.icon} {a.name}</span>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Integrations */}
        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text4)' }}>
          {proj.jira?.url && <span style={{ color: 'var(--green)' }}>✓ Jira</span>}
          {proj.git?.owner && <span style={{ color: 'var(--green)' }}>✓ Git</span>}
          {proj.confluence?.url && <span style={{ color: 'var(--green)' }}>✓ Confluence</span>}
          {!proj.jira?.url && <span>○ Jira</span>}
          {!proj.git?.owner && <span>○ Git</span>}
          {!proj.confluence?.url && <span>○ Confluence</span>}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderTop: '1px solid var(--border2)', background: 'var(--surface2)' }}>
        <span style={{ fontSize: 11, color: 'var(--text4)' }}>{proj.createdAt ? `Created ${fmtDate(proj.createdAt)}` : ''}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>Open →</span>
      </div>
    </div>
  );
}

function RightSidebar({ onNew }) {
  const { state, actions } = useApp();
  const recentProjects = [...state.projects].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Quick Actions */}
      <div className="sidebar-card">
        <div className="sidebar-card-header" style={{ cursor: 'default' }}>
          <span className="sidebar-card-title">Quick Actions</span>
        </div>
        <div style={{ padding: '6px 8px' }}>
          {[
            { label: '+ New Project', action: onNew, primary: true },
            { label: '📋 Manage Templates', action: () => actions.setPage('templates') },
          ].map(a => (
            <button
              key={a.label}
              onClick={a.action}
              style={{
                width: '100%', textAlign: 'left', border: 'none',
                background: a.primary ? 'var(--accent)' : 'transparent',
                color: a.primary ? '#fff' : 'var(--text2)',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 7,
                cursor: 'pointer', fontSize: 13, fontWeight: a.primary ? 700 : 500,
                fontFamily: 'var(--font)', transition: 'all .15s', marginBottom: 2,
                boxShadow: a.primary ? '0 2px 8px rgba(37,99,235,0.28)' : 'none', /* was rgba(161,0,255,0.28) */
              }}
              onMouseEnter={e => { if (!a.primary) { e.currentTarget.style.background = 'var(--accent-bg)'; e.currentTarget.style.color = 'var(--accent)'; } }}
              onMouseLeave={e => { if (!a.primary) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)'; } }}
            >{a.label}</button>
          ))}
        </div>
      </div>

      {/* Recent Projects */}
      {recentProjects.length > 0 && (
        <div className="sidebar-card">
          <div className="sidebar-card-header" style={{ cursor: 'default' }}>
            <span className="sidebar-card-title">Recent Projects</span>
          </div>
          <div>
            {recentProjects.map(p => (
              <div
                key={p.id}
                onClick={() => actions.setProject(p.id)}
                style={{
                  padding: '9px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  borderBottom: '1px solid var(--border2)', transition: 'background .12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-bg)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.status === 'ready' ? 'var(--green)' : 'var(--amber)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text4)' }}>{(p.agents || []).length} agents</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* About */}
      <div className="sidebar-card">
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>About Agent AI Squad</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
            AI-powered agent platform that automates your development workflow. Create projects, configure agents, and run your Jira stories end-to-end with Lead → Developer → Tester → Regression agents.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { state } = useApp();
  const [showNew, setShowNew] = useState(false);

  const projects = state.projects;

  return (
    <>
      {showNew && <NewProjectModal onClose={() => setShowNew(false)} />}

      <div className="page-with-sidebar">
        <div className="page-main">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ marginBottom: 2 }}>Projects</h1>
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>Create and manage your AI agent workflow projects</p>
            </div>
            <Btn primary onClick={() => setShowNew(true)}>+ New Project</Btn>
          </div>

          {/* Search / filter row */}
          {projects.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <SectionLabel>All Projects — {projects.length}</SectionLabel>
            </div>
          )}

          {/* Projects grid */}
          {projects.length === 0 ? (
            <div className="empty-state">
              <div className="icon">🤖</div>
              <h3 style={{ marginBottom: 8 }}>No projects yet</h3>
              <p style={{ fontSize: 13, marginBottom: 20 }}>
                Create your first project to start configuring agents and running workflows
              </p>
              <Btn primary onClick={() => setShowNew(true)}>Create Your First Project</Btn>
            </div>
          ) : (
            <div className="projects-grid">
              {projects.map(proj => (
                <ProjectCard key={proj.id} proj={proj} />
              ))}
            </div>
          )}
        </div>

        <div className="page-sidebar">
          <RightSidebar onNew={() => setShowNew(true)} />
        </div>
      </div>
    </>
  );
}
