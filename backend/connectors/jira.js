// Jira Connector - reads stories, tasks, epics

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

async function jiraFetch(config, path, options = {}) {
  const url = `${config.url.replace(/\/$/, '')}/rest/api/3${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...buildHeaders(config), ...(options.headers || {}) }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Jira API error ${res.status}: ${err}`);
  }
  return res.json();
}

export async function getStory(config, issueKey) {
  const issue = await jiraFetch(config, `/issue/${issueKey}?expand=renderedFields,names`);

  const fields = issue.fields;
  const description = extractTextFromADF(fields.description) || fields.renderedFields?.description || '';

  return {
    key: issue.key,
    summary: fields.summary,
    type: fields.issuetype?.name,
    status: fields.status?.name,
    priority: fields.priority?.name,
    assignee: fields.assignee?.displayName,
    reporter: fields.reporter?.displayName,
    description,
    acceptanceCriteria: extractTextFromADF(fields.customfield_10016) || '',
    storyPoints: fields.story_points || fields.customfield_10016 || null,
    labels: fields.labels || [],
    components: fields.components?.map(c => c.name) || [],
    fixVersions: fields.fixVersions?.map(v => v.name) || [],
    epicLink: fields.customfield_10014 || fields.parent?.key || null,
    sprint: fields.customfield_10020?.[0]?.name || null,
    createdAt: fields.created,
    updatedAt: fields.updated,
    url: `${config.url}/browse/${issue.key}`
  };
}

export async function getEpic(config, epicKey) {
  return getStory(config, epicKey);
}

export async function getStoriesInSprint(config, projectKey, maxResults = 20) {
  const jql = encodeURIComponent(
    `project = "${projectKey}" AND sprint in openSprints() ORDER BY priority ASC`
  );
  const data = await jiraFetch(config, `/search?jql=${jql}&maxResults=${maxResults}`);
  return data.issues?.map(issue => ({
    key: issue.key,
    summary: issue.fields.summary,
    type: issue.fields.issuetype?.name,
    status: issue.fields.status?.name,
    priority: issue.fields.priority?.name,
    assignee: issue.fields.assignee?.displayName,
    url: `${config.url}/browse/${issue.key}`
  })) || [];
}

export async function searchIssues(config, jql, maxResults = 10) {
  const data = await jiraFetch(
    config,
    `/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`
  );
  return data.issues?.map(issue => ({
    key: issue.key,
    summary: issue.fields.summary,
    type: issue.fields.issuetype?.name,
    status: issue.fields.status?.name,
    url: `${config.url}/browse/${issue.key}`
  })) || [];
}

export async function addComment(config, issueKey, comment) {
  return jiraFetch(config, `/issue/${issueKey}/comment`, {
    method: 'POST',
    body: JSON.stringify({
      body: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }]
      }
    })
  });
}

export async function transitionIssue(config, issueKey, transitionName) {
  const transitions = await jiraFetch(config, `/issue/${issueKey}/transitions`);
  const transition = transitions.transitions?.find(
    t => t.name.toLowerCase() === transitionName.toLowerCase()
  );
  if (!transition) throw new Error(`Transition "${transitionName}" not found`);

  return jiraFetch(config, `/issue/${issueKey}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: transition.id } })
  });
}

export async function testConnection(config) {
  try {
    await jiraFetch(config, '/myself');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Helper: extract plain text from Atlassian Document Format (ADF)
function extractTextFromADF(adf) {
  if (!adf) return '';
  if (typeof adf === 'string') return adf;
  if (adf.type === 'text') return adf.text || '';
  if (adf.content) {
    return adf.content.map(extractTextFromADF).join(' ');
  }
  return '';
}
