import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext.jsx';
import {
  Btn, Modal, ModalHeader, ModalBody, ModalFooter,
  FormGroup, SectionLabel, Spinner, getAgentMeta, AGENT_TYPES, statusTag,
} from './UI.jsx';
import * as api from '../client.js';

// ─── Template option loaders ──────────────────────────────────────────────────

function useTemplateOptions() {
  const { state } = useApp();
  const [customTemplates, setCustomTemplates] = useState([]);

  useEffect(() => {
    api.getCustomTemplates().then(setCustomTemplates).catch(() => {});
  }, []);

  // User prompts from localStorage
  const userPrompts = (() => {
    try { return JSON.parse(localStorage.getItem('ais-user-prompts') || '[]'); } catch { return []; }
  })();

  // Master template options: built-in + custom master
  const masterOptions = [
    { value: '', label: '— Select Master Template —' },
    ...AGENT_TYPES.map(t => ({ value: `builtin:${t.value}`, label: getAgentMeta(t.value).label })),
    ...customTemplates.filter(t => t.templateType === 'master').map(t => ({ value: `custom:${t.id}`, label: t.name })),
  ];

  // System prompt options: built-in + custom system-prompt
  const systemPromptOptions = [
    { value: '', label: '— Select System Prompt —' },
    ...AGENT_TYPES.map(t => ({ value: `builtin:${t.value}`, label: `${getAgentMeta(t.value).label} System Prompt` })),
    ...customTemplates.filter(t => t.templateType === 'system-prompt').map(t => ({ value: `custom:${t.id}`, label: t.name })),
  ];

  // User prompt options (optional)
  const userPromptOptions = [
    { value: '', label: '— None —' },
    ...userPrompts.map(p => ({ value: p.id, label: p.name })),
  ];

  return { masterOptions, systemPromptOptions, userPromptOptions };
}

// ─── Select component ─────────────────────────────────────────────────────────

function TemplateSelect({ label, hint, value, onChange, options }) {
  return (
    <FormGroup label={label} hint={hint}>
      <select
        className="input"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ cursor: 'pointer' }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </FormGroup>
  );
}

// ─── Agent Modal (Add / Edit) ─────────────────────────────────────────────────

function AgentModal({ agent, onClose, onSave, saving }) {
  const isEdit = !!agent;
  const { masterOptions, systemPromptOptions, userPromptOptions } = useTemplateOptions();

  const [form, setForm] = useState({
    name:               agent?.name || '',
    type:               agent?.type || 'lead-agent',
    masterTemplate:     agent?.masterTemplate || '',
    systemPromptTemplate: agent?.systemPromptTemplate || '',
    userPrompt:         agent?.userPrompt || '',
    customInstructions: agent?.customInstructions || '',
  });
  const [err, setErr] = useState('');

  function set(key, val) {
    setForm(f => {
      const next = { ...f, [key]: val };
      // Auto-populate master + system prompt when agent type changes
      if (key === 'type') {
        next.masterTemplate = `builtin:${val}`;
        next.systemPromptTemplate = `builtin:${val}`;
      }
      return next;
    });
  }

  // Auto-populate on first load for new agents (no existing selections)
  useEffect(() => {
    if (!isEdit && !form.masterTemplate && !form.systemPromptTemplate) {
      setForm(f => ({
        ...f,
        masterTemplate: `builtin:${f.type}`,
        systemPromptTemplate: `builtin:${f.type}`,
      }));
    }
  }, []);

  function handleSubmit() {
    if (!form.name.trim()) { setErr('Agent name is required'); return; }
    setErr('');
    onSave(form);
  }

  return (
    <Modal onClose={onClose} width={580}>
      <ModalHeader
        title={isEdit ? 'Edit Agent' : 'Add Agent'}
        subtitle={isEdit ? `Editing ${agent.name}` : 'Configure a new agent for this project'}
        onClose={onClose}
      />
      <ModalBody>
        {err && (
          <div style={{
            marginBottom: 14, padding: '10px 14px', borderRadius: 8,
            background: 'var(--red-bg)', border: '1px solid var(--red-border)',
            color: 'var(--red)', fontSize: 13,
          }}>{err}</div>
        )}

        {/* Agent Name */}
        <FormGroup label="Agent Name" hint="A descriptive name for this agent instance">
          <input
            className="input"
            placeholder="e.g. Lead Agent, Feature Developer…"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            autoFocus
          />
        </FormGroup>

        {/* Agent Type */}
        <FormGroup label="Agent Type">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
            {AGENT_TYPES.map(t => {
              const isSelected = form.type === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => set('type', t.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 10, textAlign: 'left',
                    border: `2px solid ${isSelected ? `var(--${t.color}-border)` : 'var(--border)'}`,
                    background: isSelected ? `var(--${t.color}-bg)` : 'var(--bg)',
                    cursor: 'pointer', transition: 'all .15s',
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: isSelected ? `var(--${t.color})` : 'var(--text)' }}>
                      {t.label}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text3)', lineHeight: 1.3 }}>
                      {t.description.slice(0, 52)}…
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </FormGroup>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border2)', margin: '4px 0 16px' }} />

        {/* Master Template */}
        <TemplateSelect
          label="Master Template"
          hint="Workflow instructions injected during agent execution"
          value={form.masterTemplate}
          onChange={v => set('masterTemplate', v)}
          options={masterOptions}
        />

        {/* System Prompt Template */}
        <TemplateSelect
          label="System Prompt Template"
          hint="Defines the agent's persona and behavior rules"
          value={form.systemPromptTemplate}
          onChange={v => set('systemPromptTemplate', v)}
          options={systemPromptOptions}
        />

        {/* User Prompt (Optional) */}
        <TemplateSelect
          label="User Prompt (Optional)"
          hint="Extra instructions or context from your custom prompts"
          value={form.userPrompt}
          onChange={v => set('userPrompt', v)}
          options={userPromptOptions}
        />

        {/* Custom Instructions */}
        <FormGroup
          label="Additional Custom Instructions (Optional)"
          hint="Free-form text appended after all templates"
        >
          <textarea
            className="input"
            style={{ minHeight: 80, fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
            placeholder="Leave empty to rely on the templates above…"
            value={form.customInstructions}
            onChange={e => set('customInstructions', e.target.value)}
          />
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Btn ghost onClick={onClose}>Cancel</Btn>
        <Btn primary onClick={handleSubmit} disabled={saving}>
          {saving ? <><Spinner /> Saving…</> : isEdit ? 'Save Changes' : 'Add Agent'}
        </Btn>
      </ModalFooter>
    </Modal>
  );
}

// ─── Agent Card (Snap2 grid design) ──────────────────────────────────────────

function AgentCard({ agent, index, total, onEdit, onDelete }) {
  const meta = getAgentMeta(agent.type);
  const [hovered, setHovered] = useState(false);

  const createdDate = agent.createdAt
    ? new Date(agent.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const masterLabel = agent.masterTemplate
    ? agent.masterTemplate.startsWith('builtin:')
      ? getAgentMeta(agent.masterTemplate.replace('builtin:', '')).label
      : 'Custom Template'
    : getAgentMeta(agent.type).label;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderTop: `4px solid var(--accent)`,
        borderRadius: 12,
        overflow: 'hidden',
        transition: 'box-shadow .18s, transform .18s',
        boxShadow: hovered ? '0 6px 24px rgba(37,99,235,0.12)' : '0 1px 4px rgba(0,0,0,0.06)', /* was rgba(161,0,255,0.12) */
        transform: hovered ? 'translateY(-2px)' : 'none',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Card Header — icon + name only, no buttons */}
      <div style={{ padding: '16px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: `var(--${meta.color}-bg)`,
          border: `1px solid var(--${meta.color}-border)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>{meta.icon}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: '#111827' }}>{agent.name}</div>
          <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 1 }}>
            Step {index + 1} of {total}{createdDate ? ` · ${createdDate}` : ''}
          </div>
        </div>
      </div>

      {/* Master Template badge */}
      <div style={{ padding: '0 16px 8px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 500 }}>Master Template:</span>
        <span style={{
          fontSize: 10.5, fontWeight: 500, padding: '1px 7px', borderRadius: 20,
          background: 'var(--accent-bg)', color: 'var(--accent)',
          border: '1px solid var(--accent-border)',
        }}>⚡ {masterLabel}</span>
      </div>

      {/* System Prompt badge if set */}
      {agent.systemPromptTemplate && (
        <div style={{ padding: '0 16px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 500 }}>System Prompt:</span>
          <span style={{
            fontSize: 10.5, fontWeight: 500, padding: '1px 7px', borderRadius: 20,
            background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0',
          }}>
            {agent.systemPromptTemplate.startsWith('builtin:')
              ? `${getAgentMeta(agent.systemPromptTemplate.replace('builtin:', '')).label} System Prompt`
              : 'Custom System Prompt'}
          </span>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Edit / Delete at bottom */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid #F3F4F6',
        display: 'flex', gap: 8,
      }}>
        <Btn ghost small style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }} onClick={() => onEdit(agent)}>Edit</Btn>
        <Btn danger small style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }} onClick={() => onDelete(agent)}>Delete</Btn>
      </div>
    </div>
  );
}

// ─── Pipeline Preview ─────────────────────────────────────────────────────────

function PipelinePreview({ agents }) {
  if (!agents || agents.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', background: 'var(--bg)', borderRadius: 8 }}>
      {agents.map((agent, i) => {
        const meta = getAgentMeta(agent.type);
        return (
          <React.Fragment key={agent.id}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: `var(--${meta.color}-bg)`,
                border: `2px solid var(--${meta.color}-border)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>{meta.icon}</div>
              <span style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {agent.name}
              </span>
            </div>
            {i < agents.length - 1 && (
              <div style={{ flex: 1, height: 2, background: 'var(--border)', margin: '0 6px', marginTop: -14 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function Agents() {
  const { state, actions } = useApp();
  const project = state.projects.find(p => p.id === state.activeProjectId);

  const [showModal, setShowModal] = useState(false);
  const [editAgent, setEditAgent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  if (!project) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
        No project selected.{' '}
        <a style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => actions.setPage('dashboard')}>
          Go to Dashboard
        </a>
      </div>
    );
  }

  const sortedAgents = [...(project.agents || [])].sort((a, b) => a.order - b.order);

  const agentsWithContext = sortedAgents;

  async function handleSave(form) {
    setSaving(true);
    try {
      if (editAgent) {
        await actions.updateAgent(project.id, editAgent.id, form);
      } else {
        await actions.addAgent(project.id, form);
      }
      setShowModal(false);
      setEditAgent(null);
    } catch (e) {
      // errors shown inside modal
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(agent) {
    setDeleting(true);
    try {
      await actions.deleteAgent(project.id, agent.id);
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  }

  const isReady = sortedAgents.length >= 2 &&
    sortedAgents.every(a => a.configured) &&
    (project.jira?.token || project.git?.token);

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12, color: 'var(--text3)' }}>
          <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => actions.setPage('dashboard')}>Dashboard</span>
          <span>›</span>
          <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => actions.setPage('workflow')}>{project.name}</span>
          <span>›</span>
          <span style={{ color: 'var(--text)' }}>Agent Configuration</span>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0 }}>Agent Configuration</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 13 }}>
              Create agents with specific templates and instructions for <strong style={{ color: 'var(--text)' }}>{project.name}</strong>
            </p>
          </div>
          <Btn primary onClick={() => { setEditAgent(null); setShowModal(true); }}>+ New Agent</Btn>
        </div>

        {/* Status Banner */}
        {isReady ? (
          <div style={{
            marginBottom: 20, padding: '12px 16px', borderRadius: 8,
            background: 'var(--green-bg)', border: '1px solid var(--green-border)',
            color: 'var(--green)', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>✓</span> All agents configured — project is ready to run.
          </div>
        ) : sortedAgents.length === 0 ? null : (
          <div style={{
            marginBottom: 20, padding: '12px 16px', borderRadius: 8,
            background: '#FFF8E1', border: '1px solid #FFE082', color: '#856A00', fontSize: 13,
          }}>
            {!project.jira?.token && !project.git?.token
              ? 'Add Jira or GitHub integration in project settings to enable workflow execution.'
              : 'Configure all agents and integrations to enable workflow execution.'}
          </div>
        )}

        {/* Agent Card Grid */}
        {sortedAgents.length === 0 ? (
          <div style={{
            padding: '56px 32px', textAlign: 'center',
            border: '2px dashed #E5E7EB', borderRadius: 16, background: '#FFFFFF',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#111827', marginBottom: 6 }}>No agents yet</div>
            <div style={{ fontSize: 13.5, color: '#6B7280', maxWidth: 440, margin: '0 auto 24px', lineHeight: 1.6 }}>
              Add a Lead Agent first, then Developer, Tester, and Regression agents to build your pipeline.
            </div>
            <Btn primary onClick={() => { setEditAgent(null); setShowModal(true); }}>+ New Agent</Btn>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 28 }}>
            {agentsWithContext.map((agent, i) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                index={i}
                total={sortedAgents.length}
                onEdit={a => { setEditAgent(a); setShowModal(true); }}
                onDelete={a => setDeleteConfirm(a)}
              />
            ))}
          </div>
        )}

        {/* Pipeline Preview */}
        {sortedAgents.length > 1 && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '16px 20px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Execution Pipeline
            </div>
            <PipelinePreview agents={sortedAgents} />
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
              Agents run sequentially. Each agent receives output from the previous agent as context.
            </div>
          </div>
        )}
      </div>

      {/* ── Right Sidebar ── */}
      <div style={{
        width: 280, flexShrink: 0, borderLeft: '1px solid var(--border)',
        background: 'var(--surface)', overflowY: 'auto', padding: '24px 20px',
      }}>
        <SectionLabel>Agent Types</SectionLabel>
        <div style={{ marginBottom: 24 }}>
          {AGENT_TYPES.map(t => (
            <div key={t.value} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 0', borderBottom: '1px solid var(--border2)',
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{t.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 12, color: `var(--${t.color})`, marginBottom: 2 }}>
                  {t.label}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.4 }}>
                  {t.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        <SectionLabel>Recommended Order</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {[
            { n: 1, label: 'Lead Agent 🎯',       hint: 'Required — entry point' },
            { n: 2, label: 'Developer Agent 💻',   hint: 'Implements changes' },
            { n: 3, label: 'Tester Agent 🧪',      hint: 'Validates output' },
            { n: 4, label: 'Regression Agent 🔁',  hint: 'Final check' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 10, fontSize: 12 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent-bg)', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 10,
              }}>{s.n}</div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{s.label}</div>
                <div style={{ color: 'var(--text3)' }}>{s.hint}</div>
              </div>
            </div>
          ))}
        </div>

        <Btn ghost small style={{ width: '100%' }} onClick={() => actions.setPage('templates')}>
          Manage Templates →
        </Btn>
      </div>

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <AgentModal
          agent={editAgent}
          onClose={() => { setShowModal(false); setEditAgent(null); }}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {/* ── Delete Confirm ── */}
      {deleteConfirm && (
        <Modal onClose={() => setDeleteConfirm(null)} width={420}>
          <ModalHeader
            title="Delete Agent"
            subtitle={`Remove "${deleteConfirm.name}" from this project`}
            onClose={() => setDeleteConfirm(null)}
          />
          <ModalBody>
            <p style={{ color: 'var(--text3)', fontSize: 14 }}>
              This will permanently remove this agent. Past runs are not affected.
            </p>
          </ModalBody>
          <ModalFooter>
            <Btn ghost onClick={() => setDeleteConfirm(null)}>Cancel</Btn>
            <Btn danger onClick={() => handleDelete(deleteConfirm)} disabled={deleting}>
              {deleting ? <><Spinner /> Deleting…</> : 'Delete Agent'}
            </Btn>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
