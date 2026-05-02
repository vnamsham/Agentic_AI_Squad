import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext.jsx';
import {
  Btn, Modal, ModalHeader, ModalBody, ModalFooter,
  FormGroup, Spinner, AGENT_TYPES, getAgentMeta,
} from './UI.jsx';
import * as api from '../client.js';

// ─── Display name helpers ─────────────────────────────────────────────────────

function masterName(agentType) {
  const meta = getAgentMeta(agentType);
  return meta.label;
}

function systemPromptName(agentType) {
  const meta = getAgentMeta(agentType);
  return `${meta.label} System Prompt`;
}

// ─── Content preview parser ───────────────────────────────────────────────────

function parsePreviewItems(text, max = 5) {
  if (!text) return [];
  const items = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const clean = line.trim();
    if (!clean || clean.startsWith('#') || clean === '---' || clean.startsWith('```')) continue;
    const stripped = clean.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
    if (stripped.length > 15) {
      items.push(stripped);
      if (items.length >= max) break;
    }
  }
  return items;
}

function PreviewItem({ text }) {
  const boldMd = text.match(/^\*\*(.+?)\*\*:?\s*(.*)/);
  if (boldMd) {
    return (
      <div style={{ marginBottom: 9, fontSize: 12.5, lineHeight: 1.5 }}>
        <strong style={{ color: '#111', fontWeight: 700 }}>{boldMd[1].replace(/\*/g, '')}:</strong>{' '}
        <em style={{ color: '#6B7280', fontStyle: 'italic' }}>{boldMd[2].replace(/\*/g, '')}</em>
      </div>
    );
  }
  const colonIdx = text.indexOf(':');
  if (colonIdx > 4 && colonIdx < 80) {
    const before = text.slice(0, colonIdx).replace(/\*\*/g, '').replace(/\*/g, '').trim();
    const after  = text.slice(colonIdx + 1).replace(/\*/g, '').trim();
    if (before.length < 70 && after.length > 3) {
      return (
        <div style={{ marginBottom: 9, fontSize: 12.5, lineHeight: 1.5 }}>
          <strong style={{ color: '#111', fontWeight: 700 }}>{before}:</strong>{' '}
          <em style={{ color: '#6B7280', fontStyle: 'italic' }}>{after}</em>
        </div>
      );
    }
  }
  return (
    <div style={{ marginBottom: 9, fontSize: 12.5, lineHeight: 1.5, color: '#6B7280' }}>
      {text.replace(/\*\*/g, '').replace(/\*/g, '')}
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({ title, icon, color, previewContent, badge, fileLabel, onView, onEdit, onDelete }) {
  const items = parsePreviewItems(previewContent, 5);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onView}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderLeft: `4px solid var(--accent)`,
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'box-shadow .18s, transform .18s',
        boxShadow: hovered ? '0 6px 24px rgba(37,99,235,0.12)' : '0 1px 4px rgba(0,0,0,0.05)', /* was rgba(161,0,255,0.12) */
        transform: hovered ? 'translateY(-2px)' : 'none',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: color ? `var(--${color}-bg)` : 'var(--accent-bg)',
            border: `1px solid ${color ? `var(--${color}-border)` : 'var(--accent-border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
          }}>{icon}</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#111827', lineHeight: 1.3 }}>{title}</span>
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0, marginLeft: 8 }}>
          <Btn ghost small onClick={e => { e.stopPropagation(); onEdit(); }}>Edit</Btn>
          {onDelete && (
            <Btn danger small onClick={e => { e.stopPropagation(); onDelete(); }}>Delete</Btn>
          )}
        </div>
      </div>

      {/* Sub-header */}
      <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
          background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB',
        }}>{badge}</span>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{fileLabel}</span>
      </div>

      <div style={{ height: 1, background: '#F3F4F6', margin: '0 16px' }} />

      {/* Preview */}
      <div style={{ padding: '12px 16px 16px', flex: 1, maxHeight: 210, overflowY: 'auto' }}>
        {items.length > 0
          ? items.map((item, i) => <PreviewItem key={i} text={item} />)
          : <div style={{ color: '#9CA3AF', fontSize: 12, fontStyle: 'italic' }}>No content yet. Click Edit to add.</div>
        }
      </div>
    </div>
  );
}

// ─── Built-in Template View/Edit Modal ───────────────────────────────────────

function BuiltinEditorModal({ agentType, templateKind, template, onClose, onSave, autoEdit = false }) {
  // templateKind: 'master' (shows both tabs) | 'system-prompt' (shows only system-prompt tab)
  const meta = getAgentMeta(agentType);
  const title = templateKind === 'master' ? masterName(agentType) : systemPromptName(agentType);

  const defaultTab = templateKind === 'system-prompt' ? 'system-prompt' : 'instructions';
  const [activeFile, setActiveFile] = useState(defaultTab);
  const [isEditing, setIsEditing] = useState(autoEdit);
  const [systemPrompt, setSystemPrompt] = useState(template?.systemPrompt || '');
  const [instructions, setInstructions] = useState(template?.instructions || '');
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [err, setErr] = useState('');

  const editValue = activeFile === 'system-prompt' ? systemPrompt : instructions;
  const setEditValue = v => activeFile === 'system-prompt' ? setSystemPrompt(v) : setInstructions(v);

  async function handleSave() {
    setSaving(true); setErr(''); setSaveOk(false);
    try {
      await onSave(activeFile, editValue);
      setSaveOk(true);
      setIsEditing(false);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const tabs = templateKind === 'master'
    ? [{ id: 'instructions', label: '📝 instructions.md' }]
    : [{ id: 'system-prompt', label: '📋 system-prompt.md' }];

  return (
    <Modal onClose={onClose} width={800}>
      {/* Custom header */}
      <div style={{
        padding: '16px 24px 12px', borderBottom: '1px solid #F3F4F6', flexShrink: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, flexShrink: 0,
            background: `var(--${meta.color}-bg)`, border: `1px solid var(--${meta.color}-border)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21,
          }}>{meta.icon}</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>{title}</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
              {templateKind === 'master' ? 'Master template — workflow instructions' : 'System prompt — agent persona and behavior'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saveOk && <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>✓ Saved</span>}
          {err && <span style={{ fontSize: 12, color: 'var(--red)' }}>✗ {err}</span>}
          {!isEditing && <Btn primary small onClick={() => setIsEditing(true)}>Edit Template</Btn>}
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9CA3AF', lineHeight: 1, padding: '0 0 0 8px' }}>×</button>
        </div>
      </div>

      {/* File Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #F3F4F6', padding: '0 24px', background: '#FAFAFA', flexShrink: 0 }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveFile(tab.id)} style={{
            padding: '10px 16px', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font)', fontSize: 12.5,
            fontWeight: activeFile === tab.id ? 700 : 500,
            borderBottom: activeFile === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeFile === tab.id ? 'var(--accent)' : '#6B7280',
            background: 'transparent', marginBottom: -1,
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {isEditing ? (
          <textarea value={editValue} onChange={e => setEditValue(e.target.value)} style={{
            display: 'block', width: '100%', height: 430, resize: 'none',
            border: 'none', outline: 'none', padding: '20px 24px',
            fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.7,
            color: '#111827', background: '#F9FAFB', boxSizing: 'border-box',
          }} spellCheck={false} />
        ) : (
          <div style={{
            padding: '20px 24px', height: 430, overflowY: 'auto',
            fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.75,
            color: '#374151', background: '#F9FAFB', whiteSpace: 'pre-wrap',
          }}>
            {editValue || <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>No content. Click "Edit Template" to add.</span>}
          </div>
        )}
      </div>

      {/* Footer */}
      {isEditing && (
        <div style={{ padding: '14px 24px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <Btn ghost onClick={() => { setIsEditing(false); setErr(''); }}>Cancel</Btn>
          <Btn primary onClick={handleSave} disabled={saving}>
            {saving ? <><Spinner /> Saving…</> : 'Save Template'}
          </Btn>
        </div>
      )}
    </Modal>
  );
}

// ─── Custom Template Add/Edit Modal ──────────────────────────────────────────

function CustomTemplateModal({ templateKind, template, onClose, onSave }) {
  // templateKind: 'master' | 'system-prompt'
  const isEdit = !!template;
  const isMaster = templateKind === 'master';

  const [name, setName] = useState(template?.name || '');
  const [instructions, setInstructions] = useState(template?.instructions || '');
  const [systemPrompt, setSystemPrompt] = useState(template?.systemPrompt || '');
  const [activeTab, setActiveTab] = useState('instructions');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleSave() {
    if (!name.trim()) { setErr('Template name is required'); return; }
    if (isMaster && !instructions.trim()) { setErr('Instructions content is required'); return; }
    if (!isMaster && !systemPrompt.trim()) { setErr('System prompt content is required'); return; }
    setErr(''); setSaving(true);
    try {
      await onSave({
        id: template?.id,
        name: name.trim(),
        templateType: templateKind,
        instructions: instructions.trim(),
        systemPrompt: systemPrompt.trim(),
      });
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal onClose={onClose} width={800}>
      <ModalHeader
        title={isEdit ? `Edit ${isMaster ? 'Master' : 'System Prompt'} Template` : `Add ${isMaster ? 'Master' : 'System Prompt'} Template`}
        subtitle={isMaster ? 'Define workflow instructions for this custom master template' : 'Define a custom system prompt for agent behavior'}
        onClose={onClose}
      />
      <ModalBody style={{ padding: 0 }}>
        {err && (
          <div style={{ margin: '14px 24px 0', padding: '10px 14px', borderRadius: 8, background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', fontSize: 13 }}>
            ✗ {err}
          </div>
        )}

        {/* Name field */}
        <div style={{ padding: '16px 24px 12px' }}>
          <FormGroup label="Template Name" hint="A descriptive name for this template">
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={isMaster ? 'e.g. Security Review Template, Performance Template…' : 'e.g. Strict Code Reviewer, Minimal Output Agent…'}
              autoFocus
            />
          </FormGroup>
        </div>

        {/* File tabs (master shows both, system-prompt shows one) */}
        {isMaster ? (
          <>
            <div style={{ padding: '0 24px 10px', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
              <span style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 700 }}>📝 instructions.md</span>
            </div>
            <textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              style={{
                display: 'block', width: '100%', height: 340, resize: 'none',
                border: 'none', outline: 'none', padding: '16px 24px',
                fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.7,
                color: '#111827', background: '#F9FAFB', boxSizing: 'border-box',
                borderTop: '1px solid #F3F4F6',
              }}
              placeholder={'## Step 1 — Analyze Requirements\n- Read the story carefully\n- Identify all acceptance criteria…'}
              spellCheck={false}
            />
          </>
        ) : (
          <>
            <div style={{ padding: '0 24px 8px', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
              <span style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 700 }}>📋 system-prompt.md</span>
            </div>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              style={{
                display: 'block', width: '100%', height: 340, resize: 'none',
                border: 'none', outline: 'none', padding: '16px 24px',
                fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.7,
                color: '#111827', background: '#F9FAFB', boxSizing: 'border-box',
                borderTop: '1px solid #F3F4F6',
              }}
              placeholder={'You are a [role] with expertise in [domain].\n\nYour responsibilities:\n- …\n\nCommunication style:\n- …\n\nOutput format:\n- …'}
              spellCheck={false}
            />
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Btn ghost onClick={onClose}>Cancel</Btn>
        <Btn primary onClick={handleSave} disabled={saving}>
          {saving ? <><Spinner /> Saving…</> : isEdit ? 'Save Changes' : `Add ${isMaster ? 'Master' : 'System Prompt'} Template`}
        </Btn>
      </ModalFooter>
    </Modal>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ name, onClose, onConfirm, deleting }) {
  return (
    <Modal onClose={onClose} width={400}>
      <ModalHeader title="Delete Template" subtitle={`Remove "${name}"`} onClose={onClose} />
      <ModalBody>
        <p style={{ color: 'var(--text3)', fontSize: 14, margin: 0 }}>
          This will permanently delete this custom template. This action cannot be undone.
        </p>
      </ModalBody>
      <ModalFooter>
        <Btn ghost onClick={onClose}>Cancel</Btn>
        <Btn danger onClick={onConfirm} disabled={deleting}>
          {deleting ? <><Spinner /> Deleting…</> : 'Delete Template'}
        </Btn>
      </ModalFooter>
    </Modal>
  );
}

// ─── Main Templates Component ─────────────────────────────────────────────────

const TABS = [
  { id: 'master',        label: 'Master Templates' },
  { id: 'system-prompt', label: 'System Prompt Templates' },
  { id: 'user',          label: 'User Prompt Templates' },
];

export default function Templates() {
  const { state, actions } = useApp();

  const [activeTab, setActiveTab]       = useState('master');
  const [customTemplates, setCustomTemplates] = useState([]);
  const [loadingCustom, setLoadingCustom]     = useState(false);

  // Built-in view/edit
  const [viewModal, setViewModal]   = useState(null);  // { agentType, kind }
  const [editModal, setEditModal]   = useState(null);  // { agentType, kind }

  // Custom template modals
  const [addCustomModal, setAddCustomModal]   = useState(null);  // 'master' | 'system-prompt'
  const [editCustomModal, setEditCustomModal] = useState(null);  // template object
  const [deleteCustomModal, setDeleteCustomModal] = useState(null); // template object
  const [deleting, setDeleting] = useState(false);

  // User prompts (localStorage)
  const [userPrompts, setUserPrompts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ais-user-prompts') || '[]'); } catch { return []; }
  });
  const [addUserModal, setAddUserModal]   = useState(false);
  const [editUserModal, setEditUserModal] = useState(null);
  const [deleteUserModal, setDeleteUserModal] = useState(null);

  useEffect(() => {
    if (!state.templatesLoaded) actions.loadTemplates();
    loadCustom();
  }, []);

  async function loadCustom() {
    setLoadingCustom(true);
    try {
      const data = await api.getCustomTemplates();
      setCustomTemplates(data);
    } catch {}
    finally { setLoadingCustom(false); }
  }

  function getBuiltinTemplate(type) {
    return state.templates.find(t => t.type === type) || { type, systemPrompt: '', instructions: '' };
  }

  async function handleSaveBuiltin(agentType, file, content) {
    await actions.saveTemplate(agentType, file, content);
  }

  async function handleSaveCustom(data) {
    if (data.id) {
      const updated = await api.updateCustomTemplate(data.id, data);
      setCustomTemplates(prev => prev.map(t => t.id === data.id ? updated : t));
    } else {
      const created = await api.createCustomTemplate(data);
      setCustomTemplates(prev => [...prev, created]);
    }
    setAddCustomModal(null);
    setEditCustomModal(null);
  }

  async function handleDeleteCustom(template) {
    setDeleting(true);
    try {
      await api.deleteCustomTemplate(template.id);
      setCustomTemplates(prev => prev.filter(t => t.id !== template.id));
    } finally {
      setDeleting(false);
      setDeleteCustomModal(null);
    }
  }

  function saveUserPrompts(prompts) {
    setUserPrompts(prompts);
    localStorage.setItem('ais-user-prompts', JSON.stringify(prompts));
  }

  function handleUserPromptSave(data) {
    if (data.id) {
      saveUserPrompts(userPrompts.map(p => p.id === data.id ? { ...p, ...data } : p));
    } else {
      saveUserPrompts([...userPrompts, { ...data, id: Date.now().toString(), createdAt: new Date().toISOString() }]);
    }
    setAddUserModal(false);
    setEditUserModal(null);
  }

  // ── Tab content helpers ───────────────────────────────────────────────────

  const customMaster = customTemplates.filter(t => t.templateType === 'master');
  const customSysPrompt = customTemplates.filter(t => t.templateType === 'system-prompt');

  const isLoadingTemplates = state.loading.templates || loadingCustom;

  // ── Page header info per tab ──────────────────────────────────────────────

  const TAB_META = {
    'master': {
      title: 'Master Templates',
      desc: 'Workflow instruction templates for each agent. Click any card to view, or Edit to modify.',
      addLabel: '+ Add Master Template',
      onAdd: () => setAddCustomModal('master'),
    },
    'system-prompt': {
      title: 'System Prompt Templates',
      desc: 'System prompts injected at the start of agent conversations. Defines each agent\'s persona, expertise, and behavior rules.',
      addLabel: '+ Add System Prompt',
      onAdd: () => setAddCustomModal('system-prompt'),
    },
    'user': {
      title: 'User Prompt Templates',
      desc: 'Custom prompts and instructions you\'ve created. Provide additional context or specialized guidance during agent execution.',
      addLabel: '+ Add Prompt',
      onAdd: () => setAddUserModal(true),
    },
  };

  const tabMeta = TAB_META[activeTab];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F9FAFB' }}>

      {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '0 32px',
        borderBottom: '1px solid #E5E7EB', background: '#FFFFFF', flexShrink: 0,
      }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '14px 22px', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font)', fontSize: 14,
            fontWeight: activeTab === tab.id ? 700 : 500,
            borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === tab.id ? 'var(--accent)' : '#6B7280',
            background: 'transparent', transition: 'all .15s', marginBottom: -1,
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div style={{ padding: '28px 36px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: '#111827' }}>
              {tabMeta.title}
            </h1>
            <p style={{ margin: 0, color: '#6B7280', fontSize: 13.5, maxWidth: 680 }}>
              {tabMeta.desc}
            </p>
          </div>
          <Btn primary onClick={tabMeta.onAdd}>{tabMeta.addLabel}</Btn>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 36px 36px' }}>
        {isLoadingTemplates ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9CA3AF', padding: 40 }}>
            <Spinner lg /> Loading templates…
          </div>
        ) : (

          /* ── MASTER TEMPLATES ─────────────────────────────────────────── */
          activeTab === 'master' ? (
            <>
              {/* Built-in section */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                  Built-in — 4 agent templates
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                  {AGENT_TYPES.map(t => {
                    const tpl = getBuiltinTemplate(t.value);
                    const meta = getAgentMeta(t.value);
                    return (
                      <TemplateCard
                        key={t.value}
                        title={masterName(t.value)}
                        icon={meta.icon}
                        color={meta.color}
                        previewContent={tpl.instructions}
                        badge="Built-in"
                        fileLabel="1 file"
                        onView={() => setViewModal({ agentType: t.value, kind: 'master' })}
                        onEdit={() => setEditModal({ agentType: t.value, kind: 'master' })}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Custom master templates */}
              {customMaster.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                    Custom — {customMaster.length} template{customMaster.length !== 1 ? 's' : ''}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                    {customMaster.map(t => (
                      <TemplateCard
                        key={t.id}
                        title={t.name}
                        icon="📄"
                        color={null}
                        previewContent={t.instructions}
                        badge="Custom"
                        fileLabel={t.systemPrompt ? '2 files' : '1 file'}
                        onView={() => setViewModal({ custom: t })}
                        onEdit={() => setEditCustomModal(t)}
                        onDelete={() => setDeleteCustomModal(t)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {customMaster.length === 0 && (
                <div style={{ marginTop: 28, padding: '24px 28px', borderRadius: 12, border: '2px dashed #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 18 }}>
                  <span style={{ fontSize: 32 }}>📄</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#374151', marginBottom: 2 }}>Add your own master templates</div>
                    <div style={{ fontSize: 13, color: '#9CA3AF' }}>Create custom agent templates for specialized workflows — security audits, performance reviews, accessibility checks, etc.</div>
                  </div>
                  <Btn ghost small style={{ flexShrink: 0 }} onClick={() => setAddCustomModal('master')}>+ Add Template</Btn>
                </div>
              )}
            </>

          /* ── SYSTEM PROMPT TEMPLATES ───────────────────────────────────── */
          ) : activeTab === 'system-prompt' ? (
            <>
              {/* Built-in section */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                  Built-in — 4 system prompts
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                  {AGENT_TYPES.map(t => {
                    const tpl = getBuiltinTemplate(t.value);
                    const meta = getAgentMeta(t.value);
                    return (
                      <TemplateCard
                        key={t.value}
                        title={systemPromptName(t.value)}
                        icon={meta.icon}
                        color={meta.color}
                        previewContent={tpl.systemPrompt}
                        badge="Built-in"
                        fileLabel="1 file"
                        onView={() => setViewModal({ agentType: t.value, kind: 'system-prompt' })}
                        onEdit={() => setEditModal({ agentType: t.value, kind: 'system-prompt' })}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Custom system prompts */}
              {customSysPrompt.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                    Custom — {customSysPrompt.length} system prompt{customSysPrompt.length !== 1 ? 's' : ''}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                    {customSysPrompt.map(t => (
                      <TemplateCard
                        key={t.id}
                        title={t.name}
                        icon="📋"
                        color={null}
                        previewContent={t.systemPrompt}
                        badge="Custom"
                        fileLabel="1 file"
                        onView={() => setViewModal({ custom: t })}
                        onEdit={() => setEditCustomModal(t)}
                        onDelete={() => setDeleteCustomModal(t)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {customSysPrompt.length === 0 && (
                <div style={{ marginTop: 28, padding: '24px 28px', borderRadius: 12, border: '2px dashed #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 18 }}>
                  <span style={{ fontSize: 32 }}>📋</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#374151', marginBottom: 2 }}>Add custom system prompts</div>
                    <div style={{ fontSize: 13, color: '#9CA3AF' }}>Define alternative agent personas — strict code reviewer, concise output agent, domain-specific expert, etc.</div>
                  </div>
                  <Btn ghost small style={{ flexShrink: 0 }} onClick={() => setAddCustomModal('system-prompt')}>+ Add System Prompt</Btn>
                </div>
              )}
            </>

          /* ── USER PROMPT TEMPLATES ────────────────────────────────────── */
          ) : (
            userPrompts.length === 0 ? (
              <div style={{ padding: '64px 32px', textAlign: 'center', border: '2px dashed #E5E7EB', borderRadius: 16, background: '#FFFFFF' }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>📝</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#111827', marginBottom: 6 }}>No custom prompts yet</div>
                <div style={{ fontSize: 13.5, color: '#6B7280', maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.6 }}>
                  Create reusable prompt templates to inject coding standards, security rules, architectural guidelines, or specialized context into your agents.
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
                  {['Code Quality', 'Security Checklist', 'Testing Standards', 'Architecture Rules'].map(ex => (
                    <span key={ex} style={{
                      fontSize: 12, padding: '5px 14px', borderRadius: 20,
                      background: 'var(--accent-bg)', color: 'var(--accent)',
                      border: '1px solid var(--accent-border)', fontWeight: 600,
                    }}>{ex}</span>
                  ))}
                </div>
                <Btn primary onClick={() => setAddUserModal(true)}>+ Add Your First Prompt</Btn>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                {userPrompts.map(prompt => (
                  <TemplateCard
                    key={prompt.id}
                    title={prompt.name}
                    icon="📝"
                    color={null}
                    previewContent={prompt.content}
                    badge={prompt.category || 'Custom'}
                    fileLabel={`${(prompt.content || '').split('\n').filter(l => l.trim()).length} lines`}
                    onView={() => setEditUserModal(prompt)}
                    onEdit={() => setEditUserModal(prompt)}
                    onDelete={() => setDeleteUserModal(prompt)}
                  />
                ))}
              </div>
            )
          )
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}

      {/* Built-in view (read-only, can switch to edit) */}
      {viewModal && !viewModal.custom && (
        <BuiltinEditorModal
          agentType={viewModal.agentType}
          templateKind={viewModal.kind}
          template={getBuiltinTemplate(viewModal.agentType)}
          onClose={() => setViewModal(null)}
          onSave={(file, content) => handleSaveBuiltin(viewModal.agentType, file, content)}
        />
      )}

      {/* Built-in direct edit (same modal, starts in edit mode) */}
      {editModal && (
        <BuiltinEditorModal
          agentType={editModal.agentType}
          templateKind={editModal.kind}
          template={getBuiltinTemplate(editModal.agentType)}
          onClose={() => setEditModal(null)}
          onSave={(file, content) => handleSaveBuiltin(editModal.agentType, file, content)}
          autoEdit={true}
        />
      )}

      {/* Custom template view (read-only modal) */}
      {viewModal?.custom && (
        <Modal onClose={() => setViewModal(null)} width={800}>
          <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid #F3F4F6', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>{viewModal.custom.name}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
                {viewModal.custom.templateType === 'master' ? 'Custom master template' : 'Custom system prompt'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn primary small onClick={() => { setEditCustomModal(viewModal.custom); setViewModal(null); }}>Edit Template</Btn>
              <button onClick={() => setViewModal(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9CA3AF', lineHeight: 1 }}>×</button>
            </div>
          </div>
          <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.75, color: '#374151', background: '#F9FAFB', whiteSpace: 'pre-wrap', minHeight: 400 }}>
            {viewModal.custom.templateType === 'master'
              ? (viewModal.custom.instructions || '(No instructions)')
              : (viewModal.custom.systemPrompt || '(No system prompt)')}
          </div>
        </Modal>
      )}

      {/* Add / Edit custom template */}
      {(addCustomModal || editCustomModal) && (
        <CustomTemplateModal
          templateKind={editCustomModal ? editCustomModal.templateType : addCustomModal}
          template={editCustomModal || null}
          onClose={() => { setAddCustomModal(null); setEditCustomModal(null); }}
          onSave={handleSaveCustom}
        />
      )}

      {/* Delete custom template */}
      {deleteCustomModal && (
        <DeleteModal
          name={deleteCustomModal.name}
          onClose={() => setDeleteCustomModal(null)}
          onConfirm={() => handleDeleteCustom(deleteCustomModal)}
          deleting={deleting}
        />
      )}

      {/* Add / Edit user prompt */}
      {(addUserModal || editUserModal) && (
        <UserPromptModal
          prompt={editUserModal || null}
          onClose={() => { setAddUserModal(false); setEditUserModal(null); }}
          onSave={handleUserPromptSave}
        />
      )}

      {/* Delete user prompt */}
      {deleteUserModal && (
        <DeleteModal
          name={deleteUserModal.name}
          onClose={() => setDeleteUserModal(null)}
          onConfirm={() => { saveUserPrompts(userPrompts.filter(p => p.id !== deleteUserModal.id)); setDeleteUserModal(null); }}
          deleting={false}
        />
      )}
    </div>
  );
}

// ─── User Prompt Modal ────────────────────────────────────────────────────────

function UserPromptModal({ prompt, onClose, onSave }) {
  const isEdit = !!prompt;
  const [name, setName]         = useState(prompt?.name || '');
  const [category, setCategory] = useState(prompt?.category || '');
  const [content, setContent]   = useState(prompt?.content || '');
  const [err, setErr]           = useState('');

  const CATEGORIES = ['Code Quality', 'Security', 'Testing', 'Documentation', 'Architecture', 'Performance', 'Other'];

  function handleSave() {
    if (!name.trim()) { setErr('Prompt name is required'); return; }
    if (!content.trim()) { setErr('Prompt content is required'); return; }
    setErr('');
    onSave({ id: prompt?.id, name: name.trim(), category: category.trim(), content: content.trim() });
  }

  return (
    <Modal onClose={onClose} width={640}>
      <ModalHeader
        title={isEdit ? 'Edit User Prompt' : 'Add User Prompt'}
        subtitle="Create a custom prompt template for additional agent guidance"
        onClose={onClose}
      />
      <ModalBody>
        {err && (
          <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', fontSize: 13 }}>{err}</div>
        )}
        <FormGroup label="Prompt Name" hint="A clear, descriptive name">
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Code Review Guidelines, Security Checklist…" autoFocus />
        </FormGroup>
        <FormGroup label="Category (Optional)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(category === cat ? '' : cat)} style={{
                padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 500,
                border: `1px solid ${category === cat ? 'var(--accent-border)' : 'var(--border)'}`,
                background: category === cat ? 'var(--accent-bg)' : 'var(--bg)',
                color: category === cat ? 'var(--accent)' : 'var(--text3)',
              }}>{cat}</button>
            ))}
          </div>
        </FormGroup>
        <FormGroup label="Prompt Content" hint="Instructions, standards, or context to inject into agent conversations">
          <textarea
            className="input"
            style={{ minHeight: 220, fontFamily: 'var(--font-mono)', fontSize: 12.5, resize: 'vertical', lineHeight: 1.65 }}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={'- Always check for SQL injection vulnerabilities\n- Ensure all API responses are properly validated\n- Follow OWASP Top 10 guidelines'}
          />
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Btn ghost onClick={onClose}>Cancel</Btn>
        <Btn primary onClick={handleSave}>{isEdit ? 'Save Changes' : 'Add Prompt'}</Btn>
      </ModalFooter>
    </Modal>
  );
}
