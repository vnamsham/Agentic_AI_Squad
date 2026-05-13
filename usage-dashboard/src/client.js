// API Client — Usage Dashboard

const BASE = '/api';

async function req(method, path) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const getProjects = ()            => req('GET', '/projects');
export const getUsage    = (projectId)   => req('GET', `/usage${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`);
