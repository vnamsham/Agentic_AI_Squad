// Usage Dashboard API Client

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

/**
 * Returns { runs: [...], summary: { runCount, totalInputTokens, totalOutputTokens, totalCostUsd } }
 */
export const getUsageRuns = () => req('GET', '/usage/runs');

/**
 * Returns { run: {...}, steps: [...] }
 */
export const getUsageRun = (projectId, runId) =>
  req('GET', `/usage/runs/${projectId}/${runId}`);
