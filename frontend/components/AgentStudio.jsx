import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../AppContext.jsx';
import { runAgent } from '../client.js';
import { Btn, Spinner, getAgentMeta, statusTag } from './UI.jsx';

// ─── Pipeline Status Bar ───────────────────────────────────────────────────────

function PipelineBar({ agents, currentIdx, stepStatuses }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '14px 24px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      marginBottom: 24,
    }}>
      {agents.map((agent, i) => {
        const meta = getAgentMeta(agent.type);
        const status = stepStatuses[agent.id] || 'pending';
        const isCurrent = i === currentIdx;
        const isDone = status === 'completed';
        const isFailed = status === 'failed';
        const isRunning = status === 'running';

        let dotBg = 'var(--bg2)';
        let dotBorder = 'var(--border)';
        let labelColor = 'var(--text4)';
        if (isDone)    { dotBg = 'var(--green)'; dotBorder = 'var(--green)'; labelColor = 'var(--green)'; }
        if (isFailed)  { dotBg = 'var(--red)';   dotBorder = 'var(--red)';   labelColor = 'var(--red)'; }
        if (isRunning) { dotBg = 'var(--accent)'; dotBorder = 'var(--accent)'; labelColor = 'var(--accent)'; }
        if (isCurrent && status === 'pending') { dotBorder = 'var(--accent)'; labelColor = 'var(--text)'; }

        return (
          <React.Fragment key={agent.id}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: dotBg, border: `2px solid ${dotBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: (isDone || isFailed || isRunning) ? '#fff' : 'var(--text3)',
                transition: 'all .3s',
                boxShadow: isRunning ? '0 0 0 4px rgba(37,99,235,0.15)' : 'none', /* was rgba(161,0,255,0.15) */
              }}>
                {isDone ? '✓' : isFailed ? '✗' : isRunning ? <Spinner /> : <span>{meta.icon}</span>}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: labelColor, whiteSpace: 'nowrap' }}>
                  {agent.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text4)' }}>
                  {isRunning ? 'Running…' : isDone ? 'Complete' : isFailed ? 'Failed' : 'Pending'}
                </div>
              </div>
            </div>
            {i < agents.length - 1 && (
              <div style={{
                flex: 2, height: 2, margin: '0 4px', marginTop: -20,
                background: isDone ? 'var(--green)' : 'var(--border)',
                transition: 'background .3s',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Agent Card ────────────────────────────────────────────────────────────────

function AgentCard({ agent, stepIndex, isActive, isLocked, agentStatus, output, onRun, onStop }) {
  const meta = getAgentMeta(agent.type);
  const [expanded, setExpanded] = useState(false);
  const outputRef = useRef(null);
  const isRunning = agentStatus === 'running';
  const isDone = agentStatus === 'completed';
  const isFailed = agentStatus === 'failed';

  // Auto-scroll output while running
  useEffect(() => {
    if (outputRef.current && isRunning) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, isRunning]);

  // Auto-expand when running or just completed
  useEffect(() => {
    if (isRunning || isDone || isFailed) setExpanded(true);
  }, [isRunning, isDone, isFailed]);

  const colorVar = `var(--${meta.color})`;
  const bgVar = `var(--${meta.color}-bg)`;
  const borderVar = `var(--${meta.color}-border)`;

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${isActive ? borderVar : 'var(--border)'}`,
      borderLeft: `4px solid ${isActive || isDone || isFailed ? colorVar : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      marginBottom: 12,
      opacity: isLocked ? 0.55 : 1,
      transition: 'all .2s',
      boxShadow: isActive ? `0 2px 12px ${bgVar}` : 'none',
    }}>
      {/* Card Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 20px', cursor: output ? 'pointer' : 'default',
      }}
        onClick={() => { if (output) setExpanded(e => !e); }}
      >
        {/* Agent icon */}
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: bgVar, border: `1px solid ${borderVar}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>{meta.icon}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--fs-base)', color: 'var(--text)' }}>
              {agent.name}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              background: bgVar, color: colorVar, border: `1px solid ${borderVar}`,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>{meta.label}</span>
            {stepIndex === 0 && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)',
              }}>Entry Point</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{meta.description}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {/* Status */}
          {agentStatus && agentStatus !== 'pending' && statusTag(agentStatus === 'completed' ? 'completed' : agentStatus === 'running' ? 'running' : 'failed')}
          {agentStatus === 'pending' && isActive && statusTag('ready')}
          {agentStatus === 'pending' && isLocked && statusTag('pending')}

          {/* Run button */}
          {isActive && agentStatus === 'pending' && (
            <Btn primary small onClick={(e) => { e.stopPropagation(); onRun(); }}>
              ▶ Run {meta.label}
            </Btn>
          )}
          {/* Rerun button — available on completed or failed agents */}
          {(isDone || isFailed) && (
            <Btn ghost small onClick={(e) => { e.stopPropagation(); onRun(); }}>
              ↺ Rerun
            </Btn>
          )}
          {/* Stop button — visible while running */}
          {isRunning && (
            <>
              <Spinner />
              <Btn
                small
                onClick={(e) => { e.stopPropagation(); onStop(); }}
                style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' }}
              >
                ■ Stop
              </Btn>
            </>
          )}

          {/* Expand toggle */}
          {output && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(x => !x); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text3)', fontSize: 16, padding: '4px 6px',
                transition: 'transform .2s',
                transform: expanded ? 'rotate(180deg)' : 'none',
              }}>▾</button>
          )}
        </div>
      </div>

      {/* Output area */}
      {expanded && output && (
        <div style={{ borderTop: '1px solid var(--border2)', padding: '0 20px 16px' }}>
          <div style={{
            marginTop: 12,
            fontSize: 11.5, fontFamily: 'var(--font-mono)',
            background: '#0F0A1A', color: '#E8D5FF',
            borderRadius: 8, padding: '14px 16px',
            maxHeight: 380, overflowY: 'auto',
            lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }} ref={outputRef}>
            {output}
            {isRunning && <span style={{ opacity: 0.6 }}>▊</span>}
          </div>
          {isDone && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, gap: 8 }}>
              <Btn ghost small onClick={() => navigator.clipboard?.writeText(output)}>
                Copy Output
              </Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AgentStudio ──────────────────────────────────────────────────────────────

export default function AgentStudio() {
  const { state, actions } = useApp();
  const project = state.projects.find(p => p.id === state.activeProjectId);
  const story = state.activeStory;

  const sortedAgents = project?.agents
    ? [...project.agents].sort((a, b) => a.order - b.order)
    : [];

  // Per-agent state
  const [stepStatuses, setStepStatuses] = useState({});
  const [outputs, setOutputs] = useState({});
  const [contexts, setContexts] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [globalError, setGlobalError] = useState(null);
  const [executionLogs, setExecutionLogs] = useState([]);
  const abortRef = useRef(null);
  const logsEndRef = useRef(null);

  const activeAgent = sortedAgents[currentIdx] || null;

  function getStatus(agentId) {
    return stepStatuses[agentId] || 'pending';
  }

  function handleRun(agentIdx) {
    const agent = sortedAgents[agentIdx];
    if (!agent) return;
    setGlobalError(null);

    // Gather previous context (outputs from all prior agents)
    const previousContext = sortedAgents
      .slice(0, agentIdx)
      .map(a => ({ agentId: a.id, agentName: a.name, agentType: a.type, output: outputs[a.id] || '' }));

    setStepStatuses(prev => ({ ...prev, [agent.id]: 'running' }));
    setOutputs(prev => ({ ...prev, [agent.id]: '' }));
    setExecutionLogs([]);

    abortRef.current = runAgent(project.id, agent.id, story?.key || story?.summary || '', previousContext, {
      onToken: (token) => {
        setOutputs(prev => ({ ...prev, [agent.id]: (prev[agent.id] || '') + token }));
      },
      onLog: (message) => {
        setExecutionLogs(prev => [...prev, message]);
        setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      },
      onComplete: (data) => {
        setStepStatuses(prev => ({ ...prev, [agent.id]: 'completed' }));
        setOutputs(prev => ({ ...prev, [agent.id]: data.output || prev[agent.id] || '' }));
        setContexts(prev => ({ ...prev, [agent.id]: data }));
        const nextIdx = agentIdx + 1;
        if (nextIdx < sortedAgents.length) {
          setCurrentIdx(nextIdx);
        } else {
          setAllDone(true);
        }
      },
      onError: (data) => {
        setStepStatuses(prev => ({ ...prev, [agent.id]: 'failed' }));
        setGlobalError(data.error || 'Agent execution failed');
      },
    });
  }

  function handleStop(agentId) {
    abortRef.current?.();
    abortRef.current = null;
    setStepStatuses(prev => ({ ...prev, [agentId]: 'failed' }));
    setExecutionLogs(prev => [...prev, '⚠ Stopped by user.']);
  }

  function handleReset() {
    setStepStatuses({});
    setOutputs({});
    setContexts({});
    setCurrentIdx(0);
    setAllDone(false);
    setGlobalError(null);
    setExecutionLogs([]);
  }

  if (!project) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
        No project selected. <a style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => actions.setPage('dashboard')}>Go to Dashboard</a>
      </div>
    );
  }

  if (!story) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
        No story selected. <a style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => actions.setPage('workflow')}>Go to Workflow</a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12, color: 'var(--text3)' }}>
          <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => actions.setPage('dashboard')}>Dashboard</span>
          <span>›</span>
          <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => actions.setPage('workflow')}>{project.name}</span>
          <span>›</span>
          <span style={{ color: 'var(--text)' }}>Agent Studio</span>
        </div>

        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => actions.setPage('workflow')}
                style={{
                  background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text3)',
                  fontWeight: 600,
                }}
              >← Back</button>
              <h1 style={{ margin: 0 }}>Agent Studio</h1>
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 13 }}>
              Step-by-step execution for <strong style={{ color: 'var(--text)' }}>{project.name}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(Object.keys(stepStatuses).length > 0) && (
              <Btn ghost small onClick={handleReset}>↺ Reset</Btn>
            )}
          </div>
        </div>

        {/* Story Banner */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24,
          padding: '14px 18px', borderRadius: 'var(--radius)',
          background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
        }}>
          <div style={{
            padding: '4px 10px', borderRadius: 6,
            background: 'var(--accent)', color: '#fff',
            fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>
            {story.key || 'STORY'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 'var(--fs-base)', marginBottom: 2 }}>
              {story.summary}
            </div>
            {story.description && (
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                {story.description.slice(0, 200)}{story.description.length > 200 ? '…' : ''}
              </div>
            )}
          </div>
          <div style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 12,
            background: story.source === 'jira' ? '#E3F0FF' : 'var(--bg2)',
            color: story.source === 'jira' ? '#0052CC' : 'var(--text3)',
            fontWeight: 600, flexShrink: 0,
          }}>
            {story.source === 'jira' ? 'Jira' : 'Manual'}
          </div>
        </div>

        {/* Global Error */}
        {globalError && (
          <div style={{
            marginBottom: 16, padding: '12px 16px', borderRadius: 8,
            background: 'var(--red-bg)', border: '1px solid var(--red-border)',
            color: 'var(--red)', fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <span>✗ {globalError}</span>
            <button
              onClick={() => setGlobalError(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 18 }}
            >×</button>
          </div>
        )}

        {/* No agents configured */}
        {sortedAgents.length === 0 && (
          <div style={{
            padding: 32, textAlign: 'center',
            border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
            color: 'var(--text3)',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No agents configured</div>
            <div style={{ fontSize: 13, marginBottom: 16 }}>Add agents to this project before running.</div>
            <Btn primary small onClick={() => actions.setPage('agents')}>Configure Agents</Btn>
          </div>
        )}

        {/* Pipeline Bar */}
        {sortedAgents.length > 0 && (
          <PipelineBar
            agents={sortedAgents}
            currentIdx={currentIdx}
            stepStatuses={stepStatuses}
          />
        )}

        {/* All Done Banner */}
        {allDone && (
          <div style={{
            marginBottom: 16, padding: '14px 20px', borderRadius: 8,
            background: 'var(--green-bg)', border: '1px solid var(--green-border)',
            color: 'var(--green)', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>✓</span>
            All agents completed successfully! The pipeline run is complete.
          </div>
        )}

        {/* Execution Log Panel */}
        {executionLogs.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Execution Log
            </div>
            <div style={{
              background: '#0F0A1A', borderRadius: 8, padding: '12px 16px',
              maxHeight: 260, overflowY: 'auto', fontFamily: 'var(--font-mono)',
              fontSize: 11.5, lineHeight: 1.7,
            }}>
              {executionLogs.map((line, i) => (
                <div key={i} style={{
                  color: line.startsWith('✓') ? '#4ade80'
                       : line.startsWith('✗') ? '#f87171'
                       : line.startsWith('📦') || line.startsWith('🧪') ? '#60a5fa'
                       : line.startsWith('⚠') ? '#fbbf24'
                       : line.startsWith('$') ? '#a78bfa'
                       : '#cbd5e1',
                }}>
                  {line}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* Agent Cards */}
        {sortedAgents.map((agent, i) => {
          const status = getStatus(agent.id);
          const alreadyRan = status === 'completed' || status === 'failed';
          return (
            <AgentCard
              key={agent.id}
              agent={agent}
              stepIndex={i}
              isActive={i === currentIdx && !allDone || alreadyRan}
              isLocked={i > currentIdx && !allDone && !alreadyRan}
              agentStatus={status}
              output={outputs[agent.id] || ''}
              onRun={() => handleRun(i)}
              onStop={() => handleStop(agent.id)}
            />
          );
        })}
      </div>

      {/* Right Sidebar */}
      <div style={{
        width: 280, flexShrink: 0, borderLeft: '1px solid var(--border)',
        background: 'var(--surface)', overflowY: 'auto', padding: '24px 20px',
      }}>
        {/* Run Summary */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 10 }}><span>Run Summary</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedAgents.map((agent, i) => {
              const st = getStatus(agent.id);
              const meta = getAgentMeta(agent.type);
              return (
                <div key={agent.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 8,
                  background: i === currentIdx && !allDone ? 'var(--accent-bg)' : 'var(--bg)',
                  border: `1px solid ${i === currentIdx && !allDone ? 'var(--accent-border)' : 'var(--border2)'}`,
                }}>
                  <span style={{ fontSize: 16 }}>{meta.icon}</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{agent.name}</span>
                  <span style={{ fontSize: 11, color: st === 'completed' ? 'var(--green)' : st === 'failed' ? 'var(--red)' : st === 'running' ? 'var(--accent)' : 'var(--text4)', fontWeight: 600 }}>
                    {st === 'completed' ? '✓' : st === 'failed' ? '✗' : st === 'running' ? '⟳' : '○'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Instructions */}
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}><span>How It Works</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { n: 1, t: 'Run Lead Agent', d: 'Analyzes story, creates execution plan' },
              { n: 2, t: 'Run Developer Agent', d: 'Implements code changes' },
              { n: 3, t: 'Run Tester Agent', d: 'Validates changes, writes test cases' },
              { n: 4, t: 'Run Regression Agent', d: 'Checks for regressions, confirms clear' },
            ].map(step => (
              <div key={step.n} style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--accent-bg)', color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 10,
                }}>{step.n}</div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 1 }}>{step.t}</div>
                  <div style={{ color: 'var(--text3)', lineHeight: 1.4 }}>{step.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div style={{ marginTop: 24 }}>
          <div className="section-label" style={{ marginBottom: 10 }}><span>Quick Links</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Btn ghost small onClick={() => actions.setPage('workflow')}>← Back to Workflow</Btn>
            <Btn ghost small onClick={() => actions.setPage('agents')}>Manage Agents</Btn>
            <Btn ghost small onClick={() => actions.setPage('templates')}>Edit Templates</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
