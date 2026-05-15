// Usage Dashboard — API Client

const BASE = '/api';

async function req(path) {
  const res = await fetch(BASE + path);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export function getProjects() {
  return req('/projects');
}

export function getSummary(projectId) {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return req(`/usage/summary${qs}`);
}

export function getRuns(projectId, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (projectId) params.set('projectId', projectId);
  return req(`/usage/runs?${params.toString()}`);
}
