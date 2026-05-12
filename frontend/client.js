// API Client — Agent AI Squad

const BASE = '/api';

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── Status ───────────────────────────────────────────────────────────────────
export const getStatus = () => req('GET', '/status');

// ─── Projects ─────────────────────────────────────────────────────────────────
export const getProjects    = ()        => req('GET',    '/projects');
export const getProject     = (id)      => req('GET',    `/projects/${id}`);
export const createProject  = (data)    => req('POST',   '/projects', data);
export const updateProject  = (id, d)   => req('PUT',    `/projects/${id}`, d);
export const deleteProject  = (id)      => req('DELETE', `/projects/${id}`);
export const testConnection = (id, type)=> req('POST',   `/projects/${id}/test-connection/${type}`);

// ─── Stories ──────────────────────────────────────────────────────────────────
export const addStory    = (projectId, data)       => req('POST',   `/projects/${projectId}/stories`, data);
export const deleteStory = (projectId, storyId)    => req('DELETE', `/projects/${projectId}/stories/${storyId}`);
export const getJiraStories = (projectId)          => req('GET',    `/projects/${projectId}/jira-stories`);

// ─── Agents ───────────────────────────────────────────────────────────────────
export const addAgent    = (pid, d)        => req('POST',   `/projects/${pid}/agents`, d);
export const updateAgent = (pid, aid, d)   => req('PUT',    `/projects/${pid}/agents/${aid}`, d);
export const deleteAgent = (pid, aid)      => req('DELETE', `/projects/${pid}/agents/${aid}`);

// ─── Templates ────────────────────────────────────────────────────────────────
export const getTemplates    = ()          => req('GET', '/templates');
export const getTemplate     = (type)     => req('GET', `/templates/${type}`);
export const updateTemplate  = (t, f, c)  => req('PUT', `/templates/${t}/${f}`, { content: c });

// ─── Custom Templates ─────────────────────────────────────────────────────────
export const getCustomTemplates    = ()        => req('GET',    '/custom-templates');
export const createCustomTemplate  = (data)    => req('POST',   '/custom-templates', data);
export const updateCustomTemplate  = (id, d)   => req('PUT',    `/custom-templates/${id}`, d);
export const deleteCustomTemplate  = (id)      => req('DELETE', `/custom-templates/${id}`);

// ─── Runs ─────────────────────────────────────────────────────────────────────
export const getRuns = (pid)           => req('GET', `/projects/${pid}/runs`);
export const getRun  = (pid, rid)      => req('GET', `/projects/${pid}/runs/${rid}`);

export const getUsage = (projectId) => req('GET', '/usage' + (projectId ? `?projectId=${projectId}` : ''));

// ─── Single-agent SSE run ─────────────────────────────────────────────────────

export function runAgent(projectId, agentId, storyKey, previousContext, callbacks) {
  const { onToken, onComplete, onError, onLog } = callbacks;
  const controller = new AbortController();

  fetch(`${BASE}/projects/${projectId}/run-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, storyKey, previousContext }),
    signal: controller.signal,
  }).then(res => {
    if (!res.ok) {
      return res.json().then(d => { throw new Error(d.error || 'Run failed'); });
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    function read() {
      reader.read().then(({ done, value }) => {
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('event: ')) { currentEvent = line.slice(7).trim(); }
          else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === 'step_token')   onToken?.(data.token);
              if (currentEvent === 'pipeline_log') onLog?.(data.message);
              if (currentEvent === 'complete')     onComplete?.(data);
              if (currentEvent === 'error')        onError?.(data);
            } catch {}
            currentEvent = '';
          }
        }
        read();
      }).catch(err => {
        if (err.name !== 'AbortError') onError?.({ error: err.message });
      });
    }
    read();
  }).catch(err => {
    if (err.name !== 'AbortError') onError?.({ error: err.message });
  });

  return () => controller.abort();
}

// ─── Full pipeline SSE run ────────────────────────────────────────────────────

export function runPipeline(projectId, storyKey, callbacks) {
  const { onStart, onLog, onStepStart, onStepToken, onStepComplete, onStepError, onComplete, onError } = callbacks;

  fetch(`${BASE}/projects/${projectId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jiraStory: storyKey }),
  }).then(res => {
    if (!res.ok) {
      return res.json().then(d => { throw new Error(d.error || 'Run failed'); });
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', currentEvent = '';

    function read() {
      reader.read().then(({ done, value }) => {
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('event: ')) { currentEvent = line.slice(7).trim(); }
          else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const ev = currentEvent;
              if (ev === 'run_started')    onStart?.(data);
              if (ev === 'pipeline_log')   onLog?.(data);
              if (ev === 'step_start')     onStepStart?.(data);
              if (ev === 'step_token')     onStepToken?.(data);
              if (ev === 'step_complete')  onStepComplete?.(data);
              if (ev === 'step_error')     onStepError?.(data);
              if (ev === 'run_complete' || ev === 'pipeline_complete') onComplete?.(data);
              if (ev === 'run_error')      onError?.(data);
            } catch {}
            currentEvent = '';
          }
        }
        read();
      }).catch(err => onError?.({ error: err.message }));
    }
    read();
  }).catch(err => onError?.({ error: err.message }));
}
