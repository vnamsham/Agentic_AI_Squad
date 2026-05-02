import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext.jsx';
import { Modal, ModalHeader, ModalBody, ModalFooter, AGENT_TYPES, getAgentType, FormGroup, Alert } from './UI.jsx';
import * as api from '../client.js';

export default function AgentConfig({ project, onDone }) {
  const { addAgent, updateAgent, deleteAgent } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editAgent, setEditAgent] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'lead-agent', customInstructions: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [templatePreview, setTemplatePreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const sortedAgents = [...(project.agents || [])].sort((a, b) => a.order - b.order);

  function openAdd() {
    setEditAgent(null);
    setForm({ name: '', type: 'lead-agent', customInstructions: '' });
    setTemplatePreview(null);
    setError('');
    setShowModal(true);
  }

  function openEdit(agent) {
    setEditAgent(agent);
    setForm({
      name: agent.name,
      type: agent.type,
      customInstructions: agent.customInstructions || ''
    });
    setTemplatePreview(null);
    setError('');
    setShowModal(true);
  }

  async function loadPreview(type) {
    setLoadingPreview(true);
    try {
      const t = await api.getTemplate(type);
      setTemplatePreview(t);
    } catch {
      setTemplatePreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  useEffect(() => {
    if (showModal && form.type) {
      loadPreview(form.type);
    }
  }, [form.type, showModal]);

  async function handleSave() {
    if (!form.name.trim()) { setError('Agent name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editAgent) {
        await updateAgent(project.id, editAgent.id, form);
      } else {
        await addAgent(project.id, { ...form, templateType: form.type });
      }
      setShowModal(false);
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteAgent(project.id, deleteTarget.id);
      setDeleteTarget(null);
      onDone?.();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  // Suggested order: Lead → Developer → Tester → Regression
  const suggestedOrder = ['lead-agent', 'developer-agent', 'tester-agent', 'regression-agent'];
  const configuredTypes = sortedAgents.map(a => a.type);
  const missingTypes = suggestedOrder.filter(t => !configuredTypes.includes(t));

  return (
    <div>
      {/* Pipeline Visualization */}
      {sortedAgents.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title">Pipeline Flow</div>
          </div>
          <div className="pipeline">
            {sortedAgents.map((agent, i) => {
              const at = getAgentType(agent.type);
              return (
                <React.Fragment key={agent.id}>
                  {i > 0 && <div className="pipeline-arrow">→</div>}
                  <div className={`pipeline-step`}>
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
        </div>
      )}

      {/* Readiness Check */}
      {missingTypes.length > 0 && sortedAgents.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <span>⚠️</span>
          <div>
            <strong>Recommended agents not yet configured:</strong>{' '}
            {missingTypes.map(t => getAgentType(t).label).join(', ')}
          </div>
        </div>
      )}

      {/* Agents List */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            Configured Agents
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
              ({sortedAgents.length} agent{sortedAgents.length !== 1 ? 's' : ''})
            </span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Agent</button>
        </div>

        {sortedAgents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              No agents configured
            </div>
            <div style={{ fontSize: 12, marginBottom: 16 }}>
              Add agents to define your pipeline. The recommended setup is:<br />
              Lead Agent → Developer Agent → Tester Agent → Regression Agent
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {AGENT_TYPES.map(t => (
                <button
                  key={t.value}
                  className={`btn btn-sm`}
                  style={{
                    background: `var(--${t.color}-bg)`,
                    color: `var(--${t.color})`,
                    borderColor: `var(--${t.color}-border)`
                  }}
                  onClick={() => {
                    setForm({ name: t.label, type: t.value, customInstructions: '' });
                    setEditAgent(null);
                    setError('');
                    setTemplatePreview(null);
                    setShowModal(true);
                  }}
                >
                  {t.icon} Add {t.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="agents-list">
            {sortedAgents.map((agent, i) => {
              const at = getAgentType(agent.type);
              return (
                <div key={agent.id} className="agent-item">
                  <div className="agent-item-order">{i + 1}</div>
                  <div className="agent-item-icon">{at.icon}</div>
                  <div className="agent-item-info">
                    <div className="agent-item-name">{agent.name}</div>
                    <div className="agent-item-template">
                      <span className={`badge badge-${at.color}`}>{at.label}</span>
                      {agent.customInstructions && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                          + custom instructions
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="agent-item-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(agent)}>
                      ✏️ Edit
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(agent)}>
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Quick-add missing agents */}
            {missingTypes.length > 0 && (
              <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>Quick add:</span>
                {missingTypes.map(t => {
                  const at = getAgentType(t);
                  return (
                    <button
                      key={t}
                      className="btn btn-sm"
                      style={{ background: `var(--${at.color}-bg)`, color: `var(--${at.color})`, borderColor: `var(--${at.color}-border)` }}
                      onClick={() => {
                        setForm({ name: at.label, type: t, customInstructions: '' });
                        setEditAgent(null);
                        setError('');
                        setTemplatePreview(null);
                        setShowModal(true);
                      }}
                    >
                      {at.icon} {at.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Add/Edit Modal ── */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)} size="xl">
          <ModalHeader
            title={editAgent ? `Edit Agent: ${editAgent.name}` : 'Add Agent'}
            onClose={() => setShowModal(false)}
          />
          <ModalBody>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Left: Form */}
              <div>
                {error && <Alert type="danger">{error}</Alert>}

                <FormGroup label="Agent Name *">
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Lead Agent, Backend Developer"
                    autoFocus
                  />
                </FormGroup>

                <FormGroup label="Agent Type *" hint="Determines which template and role is applied">
                  <select
                    className="form-select"
                    value={form.type}
                    onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  >
                    {AGENT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>
                        {t.icon} {t.label}
                      </option>
                    ))}
                  </select>
                </FormGroup>

                {/* Type description card */}
                {(() => {
                  const at = getAgentType(form.type);
                  return (
                    <div style={{
                      padding: '10px 12px',
                      background: `var(--${at.color}-bg)`,
                      border: `1px solid var(--${at.color}-border)`,
                      borderRadius: 'var(--radius)',
                      marginBottom: 16,
                      fontSize: 12,
                      color: `var(--${at.color})`
                    }}>
                      {at.icon} <strong>{at.label}</strong>: {at.description}
                    </div>
                  );
                })()}

                <FormGroup
                  label="Custom Instructions"
                  hint="Additional instructions specific to this agent instance. These supplement the template."
                >
                  <textarea
                    className="form-textarea"
                    value={form.customInstructions}
                    onChange={e => setForm(p => ({ ...p, customInstructions: e.target.value }))}
                    placeholder={`Optionally add project-specific instructions for this agent...\n\nExample:\n- Focus on the payments module\n- Always follow the company coding standards in Confluence\n- Use the existing test patterns in /tests/`}
                    rows={7}
                  />
                </FormGroup>
              </div>

              {/* Right: Template Preview */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  Template Preview
                </div>
                {loadingPreview ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                    <span className="spinner" />
                  </div>
                ) : templatePreview ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>System Prompt</div>
                      <div style={{
                        background: 'var(--bg-primary)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)', padding: '10px 12px',
                        fontSize: 11, color: 'var(--text-secondary)',
                        maxHeight: 160, overflowY: 'auto', fontFamily: 'var(--font-mono)',
                        lineHeight: 1.5, whiteSpace: 'pre-wrap'
                      }}>
                        {templatePreview.systemPrompt || '(no system prompt)'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Instructions</div>
                      <div style={{
                        background: 'var(--bg-primary)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)', padding: '10px 12px',
                        fontSize: 11, color: 'var(--text-secondary)',
                        maxHeight: 200, overflowY: 'auto', fontFamily: 'var(--font-mono)',
                        lineHeight: 1.5, whiteSpace: 'pre-wrap'
                      }}>
                        {templatePreview.instructions || '(no instructions)'}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      Edit these in the Templates page
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>
                    No template loaded
                  </div>
                )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="spinner" /> Saving...</> : editAgent ? 'Save Changes' : 'Add Agent'}
            </button>
          </ModalFooter>
        </Modal>
      )}

      {/* ─── Delete Agent Confirm ── */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} size="sm">
          <ModalHeader title="Remove Agent" onClose={() => setDeleteTarget(null)} />
          <ModalBody>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Remove <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.name}</strong> from the pipeline?
            </p>
          </ModalBody>
          <ModalFooter>
            <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete}>Remove</button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
