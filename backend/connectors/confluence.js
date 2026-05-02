// Confluence Connector - reads documentation, architecture pages, requirements

export function isConfigured(config) {
  return !!(config?.url && config?.email && config?.token);
}

function buildHeaders(config) {
  const creds = Buffer.from(`${config.email}:${config.token}`).toString('base64');
  return {
    Authorization: `Basic ${creds}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
}

async function confluenceFetch(config, path, options = {}) {
  const baseUrl = config.url.replace(/\/$/, '');
  const url = `${baseUrl}/rest/api${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...buildHeaders(config), ...(options.headers || {}) }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Confluence API error ${res.status}: ${err}`);
  }
  return res.json();
}

export async function searchPages(config, query, spaceKey, maxResults = 10) {
  let cql = `text ~ "${query}" AND type = page`;
  if (spaceKey) cql += ` AND space.key = "${spaceKey}"`;
  cql += ' ORDER BY lastModified DESC';

  const data = await confluenceFetch(
    config,
    `/content/search?cql=${encodeURIComponent(cql)}&limit=${maxResults}&expand=body.view,metadata.labels`
  );

  return data.results?.map(page => ({
    id: page.id,
    title: page.title,
    spaceKey: page.space?.key,
    url: `${config.url.replace('/wiki', '')}/wiki${page._links?.webui || ''}`,
    excerpt: stripHtml(page.body?.view?.value || '').slice(0, 300)
  })) || [];
}

export async function getPage(config, pageId) {
  const page = await confluenceFetch(
    config,
    `/content/${pageId}?expand=body.view,version,space,ancestors`
  );
  return {
    id: page.id,
    title: page.title,
    spaceKey: page.space?.key,
    version: page.version?.number,
    url: `${config.url.replace('/wiki', '')}/wiki${page._links?.webui || ''}`,
    content: stripHtml(page.body?.view?.value || ''),
    ancestors: page.ancestors?.map(a => a.title) || []
  };
}

export async function getPagesByLabel(config, label, spaceKey, maxResults = 10) {
  let cql = `label = "${label}" AND type = page`;
  if (spaceKey) cql += ` AND space.key = "${spaceKey}"`;

  const data = await confluenceFetch(
    config,
    `/content/search?cql=${encodeURIComponent(cql)}&limit=${maxResults}`
  );

  return data.results?.map(p => ({
    id: p.id,
    title: p.title,
    url: `${config.url.replace('/wiki', '')}/wiki${p._links?.webui || ''}`
  })) || [];
}

export async function getSpacePages(config, spaceKey, maxResults = 20) {
  const data = await confluenceFetch(
    config,
    `/content?spaceKey=${spaceKey}&limit=${maxResults}&type=page&orderby=modified+desc`
  );
  return data.results?.map(p => ({
    id: p.id,
    title: p.title,
    url: `${config.url.replace('/wiki', '')}/wiki${p._links?.webui || ''}`
  })) || [];
}

export async function testConnection(config) {
  try {
    await confluenceFetch(config, '/space?limit=1');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
