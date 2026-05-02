// GitHub Connector - reads repo structure, files, creates branches and PRs

export function isConfigured(config) {
  return !!(config?.token && config?.owner && config?.repo);
}

function buildHeaders(token) {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'AgentAISquad/1.0'
  };
}

async function githubFetch(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...buildHeaders(token), ...(options.headers || {}) }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${err}`);
  }
  return res.json();
}

export async function getRepoInfo(config) {
  const { token, owner, repo } = config;
  return githubFetch(`https://api.github.com/repos/${owner}/${repo}`, token);
}

export async function getRepoTree(config, branch = 'main') {
  const { token, owner, repo } = config;
  const data = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    token
  );
  return data.tree
    ?.filter(f => f.type === 'blob')
    .map(f => f.path)
    .filter(p => !p.includes('node_modules') && !p.includes('.git'))
    .slice(0, 200) || [];
}

export async function getFileContent(config, path, branch = 'main') {
  const { token, owner, repo } = config;
  try {
    const data = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      token
    );
    if (data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return data.content;
  } catch {
    return null;
  }
}

export async function searchCode(config, query) {
  const { token, owner, repo } = config;
  try {
    const data = await githubFetch(
      `https://api.github.com/search/code?q=${encodeURIComponent(query)}+repo:${owner}/${repo}&per_page=10`,
      token
    );
    return data.items?.map(i => ({
      path: i.path,
      url: i.html_url,
      snippet: i.text_matches?.[0]?.fragment || ''
    })) || [];
  } catch {
    return [];
  }
}

export async function createBranch(config, branchName, fromBranch = 'main') {
  const { token, owner, repo } = config;
  // Get the SHA of the base branch
  const ref = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${fromBranch}`,
    token
  );
  const sha = ref.object.sha;

  await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha })
    }
  );
  return { branchName, sha };
}

export async function createOrUpdateFile(config, path, content, message, branch) {
  const { token, owner, repo } = config;
  // Check if file exists to get its SHA
  let sha;
  try {
    const existing = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      token
    );
    sha = existing.sha;
  } catch {
    // File doesn't exist yet
  }

  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch
  };
  if (sha) body.sha = sha;

  return githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    token,
    { method: 'PUT', body: JSON.stringify(body) }
  );
}

export async function createPullRequest(config, { title, body, head, base = 'main' }) {
  const { token, owner, repo } = config;
  const pr = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ title, body, head, base })
    }
  );
  return { number: pr.number, url: pr.html_url, title: pr.title };
}

export async function testConnection(config) {
  try {
    await getRepoInfo(config);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
