import React from 'react';
import { useApp } from '../AppContext.jsx';
import accentureLogo from '../src/accenture-logo.ico';

const PROJECT_PAGES = ['workflow', 'agent-studio', 'agents'];

export default function Nav() {
  const { state, actions } = useApp();
  const serverOk = state.serverStatus?.ok;
  const activeProject = state.projects.find(p => p.id === state.activeProjectId);

  const tabs = [
    { id: 'dashboard',    label: 'Dashboard' },
    { id: 'workflow',     label: 'Workflow' },
    { id: 'agents',       label: 'Agent Studio' },
    { id: 'templates',    label: 'Templates' },

    { id: 'usage',        label: 'Usage & Cost' },
  ];

  return (
    <nav style={{
      display: 'flex', alignItems: 'center',
      padding: '0 28px', height: 52, flexShrink: 0,
      background: '#FFFFFF',
      borderBottom: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      position: 'relative', zIndex: 100,
    }}>
      {/* Brand */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginRight: 36, flexShrink: 0, cursor: 'pointer',
        }}
        onClick={() => { actions.setPage('dashboard'); }}
      >
        <img src={accentureLogo} width="28" height="28" alt="Accenture" style={{ flexShrink: 0, objectFit: 'contain' }} />
        <div style={{
          width: 32, height: 32, background: 'var(--accent)',
          borderRadius: 8, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 14, fontWeight: 900,
          color: '#fff', letterSpacing: '-0.5px', flexShrink: 0,
          boxShadow: '0 2px 8px rgba(37,99,235,0.28)', /* was rgba(161,0,255,0.28) */
        }}>AI</div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{
            fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 'var(--fs-lg)',
            color: 'var(--text)', letterSpacing: '-0.2px',
          }}>Agentic AI Squad</span>
          <span style={{
            fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 10.5,
            color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 1,
          }}>Platform</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, flex: 1 }}>
        {tabs.map(tab => {
          const needsProject = PROJECT_PAGES.includes(tab.id);
          const isDisabled = needsProject && !state.activeProjectId;
          const isActive = state.page === tab.id || (tab.id === 'workflow' && state.page === 'agent-studio');

          return (
            <button
              key={tab.id}
              onClick={() => { if (!isDisabled) actions.setPage(tab.id); }}
              title={isDisabled ? 'Select a project first' : undefined}
              style={{
                padding: '6px 14px', borderRadius: 7, border: 'none',
                fontSize: 'var(--fs-base)', fontWeight: isActive ? 600 : 500,
                fontFamily: 'var(--font)',
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? '#FFFFFF' : isDisabled ? 'var(--text4)' : 'var(--text3)',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                transition: 'all .15s',
              }}
              onMouseEnter={e => { if (!isActive && !isDisabled) { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.color = 'var(--text)'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isDisabled ? 'var(--text4)' : 'var(--text3)'; } }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Active project pill */}
        {activeProject && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
            borderRadius: 20, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
            fontSize: 11, fontWeight: 600, color: 'var(--accent)', maxWidth: 200,
          }}>
            <span style={{ fontSize: 10 }}>▶</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeProject.name}
            </span>
          </div>
        )}

        {/* Server status */}
        {state.serverStatus && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 20,
            background: serverOk ? 'var(--green-bg)' : 'var(--red-bg)',
            border: `1px solid ${serverOk ? 'var(--green-border)' : 'var(--red-border)'}`,
            fontSize: 11, fontWeight: 600,
            color: serverOk ? 'var(--green)' : 'var(--red)',
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: serverOk ? 'var(--green)' : 'var(--red)',
            }} />
            {serverOk ? 'Server Online' : 'Backend Offline'}
          </div>
        )}

        {/* Avatar */}
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0,
        }}>AI</div>
      </div>
    </nav>
  );
}
