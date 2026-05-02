import React from 'react';

// ─── Btn ──────────────────────────────────────────────────────────────────────
export function Btn({ children, primary, ghost, danger, success, small, large, icon, onClick, style, disabled, ...props }) {
  let cls = 'btn';
  if (primary)  cls += ' btn-primary';
  else if (ghost)   cls += ' btn-ghost';
  else if (danger)  cls += ' btn-danger';
  else if (success) cls += ' btn-success';
  else              cls += ' btn-secondary';
  if (small) cls += ' btn-sm';
  if (large) cls += ' btn-lg';
  if (icon)  cls += ' btn-icon';

  return (
    <button className={cls} onClick={onClick} disabled={disabled} style={style} {...props}>
      {children}
    </button>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ children, onClose, width = 520 }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(30,0,80,0.45)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 1000, padding: 20,
      }}
      onClick={e => e.target === e.currentTarget && onClose?.()}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
        width: '100%', maxWidth: width, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, subtitle, onClose }) {
  return (
    <div style={{
      padding: '20px 24px 16px', borderBottom: '1px solid var(--border2)',
      flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    }}>
      <div>
        <h2 style={{ marginBottom: subtitle ? 2 : 0 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>{subtitle}</p>}
      </div>
      {onClose && (
        <button onClick={onClose} style={{
          background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
          color: 'var(--text3)', lineHeight: 1, padding: '0 0 0 12px', flexShrink: 0,
        }}>×</button>
      )}
    </div>
  );
}

export function ModalBody({ children, style }) {
  return (
    <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, ...style }}>
      {children}
    </div>
  );
}

export function ModalFooter({ children }) {
  return (
    <div style={{
      padding: '14px 24px', borderTop: '1px solid var(--border2)',
      display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, style, ...props }) {
  return (
    <div className="card" style={style} {...props}>{children}</div>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────
export function ProgressBar({ pct = 0 }) {
  const p = Math.min(Math.max(pct, 0), 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${p}%`, borderRadius: 3,
          background: p === 100 ? 'linear-gradient(90deg,#00B96B,#00E676)' : 'linear-gradient(90deg,#2563EB,#60A5FA)', /* was #A100FF,#C840FF */
          transition: 'width .4s ease',
        }} />
      </div>
      <span style={{
        fontSize: 11, fontWeight: 700, minWidth: 32, textAlign: 'right',
        color: p === 100 ? 'var(--green)' : 'var(--accent)',
      }}>{p}%</span>
    </div>
  );
}

// ─── Tag ──────────────────────────────────────────────────────────────────────
export function Tag({ children, variant = 'pending' }) {
  return <span className={`tag tag-${variant}`}>{children}</span>;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ lg }) {
  return <span className={`spinner${lg ? ' spinner-lg' : ''}`} />;
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────
export function SectionLabel({ children }) {
  return (
    <div className="section-label">
      <span>{children}</span>
    </div>
  );
}

// ─── FormGroup ────────────────────────────────────────────────────────────────
export function FormGroup({ label, hint, children }) {
  return (
    <div className="form-group">
      {label && <label>{label}</label>}
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

// ─── Agent type definitions ───────────────────────────────────────────────────
export const AGENT_TYPES = [
  { value: 'lead-agent',       label: 'Lead Agent',       icon: '🎯', color: 'lead',       description: 'Technical lead — analyzes requirements, orchestrates the team, raises PRs' },
  { value: 'developer-agent',  label: 'Developer Agent',  icon: '💻', color: 'developer',  description: 'Implements code changes based on lead agent instructions' },
  { value: 'tester-agent',     label: 'Tester Agent',     icon: '🧪', color: 'tester',     description: 'QA engineer — validates changes against acceptance criteria' },
  { value: 'regression-agent', label: 'Regression Agent', icon: '🔁', color: 'regression', description: 'Ensures existing functionality is not broken by new changes' },
];

export function getAgentMeta(type) {
  return AGENT_TYPES.find(t => t.value === type) || { value: type, label: type, icon: '🤖', color: 'pending', description: '' };
}

// ─── Status helpers ───────────────────────────────────────────────────────────
export function statusTag(status) {
  const map = {
    ready:     { label: '✓ Ready',     variant: 'ready' },
    draft:     { label: '○ Draft',     variant: 'draft' },
    running:   { label: '⟳ Running',   variant: 'running' },
    completed: { label: '✓ Complete',  variant: 'done' },
    failed:    { label: '✗ Failed',    variant: 'failed' },
    pending:   { label: '○ Pending',   variant: 'pending' },
  };
  const s = map[status] || { label: status, variant: 'pending' };
  return <Tag variant={s.variant}>{s.label}</Tag>;
}

export function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
