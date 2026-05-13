const BASE = '/api';

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export function getUsage({ projectId, from, to } = {}) {
  const params = new URLSearchParams();
  if (projectId) params.set('projectId', projectId);
  if (from)      params.set('from', from);
  if (to)        params.set('to', to);
  const qs = params.toString();
  return req('GET', `/usage${qs ? `?${qs}` : ''}`);
}

export const getProjects = () => req('GET', '/projects');
