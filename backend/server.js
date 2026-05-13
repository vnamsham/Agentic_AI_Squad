import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  readFile, writeFile, mkdir, readdir, rename, rm, access
} from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { runPipeline, runSingleAgent } from './agents/orchestrator.js';
import * as github from './connectors/github.js';
import * as jira from './connectors/jira.js';
import * as confluence from './connectors/confluence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3030;
const DATA_DIR = join(__dirname, 'data');
const TEMPLATES_DIR = join(__dirname, 'templates');

const AGENT_TYPES = ['lead-agent', 'developer-agent', 'tester-agent', 'regression-agent'];

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure data directory exists
await mkdir(DATA_DIR, { recursive: true });

// ─── Storage Helpers ──────────────────────────────────────────────────────────

async function readJSON(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

async function writeJSON(filePath, data) {
  const tmp = filePath + '.tmp';
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await rename(tmp, filePath);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function slugify(name) {
  return name.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50) || 'project';
}

function projectDir(project) {
  return join(DATA_DIR, project.dataFolder || project.id);
}

async function getProject(id) {
  // Fast path: try UUID folder (existing projects) and named folder via index
  const entries = await readdir(DATA_DIR, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'runs') continue;
    try {
      const p = await readJSON(join(DATA_DIR, entry.name, 'project.json'));
      if (p?.id === id) return p;
    } catch {}
  }
  return null;
}

async function saveProject(project) {
  const dir = projectDir(project);
  await mkdir(dir, { recursive: true });
  await mkdir(join(dir, 'runs'), { recursive: true });
  await writeJSON(join(dir, 'project.json'), project);
  return project;
}

function computeStatus(project) {
  if (!project.agents || project.agents.length === 0) return 'draft';
  const allConfigured = project.agents.every(a => a.configured);
  const hasIntegrations =
    (project.jira?.url && project.jira?.token) ||
    (project.git?.token && project.git?.owner);
  return allConfigured && hasIntegrations ? 'ready' : 'draft';
}

// ─── Status ───────────────────────────────────────────────────────────────────


// ─── Usage & Cost ─────────────────────────────────────────────────────────────

app.get('/api/usage', async (req, res) => {
  // NOTE: This is a scan-on-read approach. Add pagination/caching if run count exceeds ~500.
  try {
    const { projectId, from, to } = req.query;
    const fromDate = from ? new Date(from) : null;
    const toDate   = to   ? new Date(to)   : null;

    const entries = await readdir(DATA_DIR, { withFileTypes: true }).catch(() => []);
    const runs = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'runs') continue;

      let project = null;
      try {
        project = await readJSON(join(DATA_DIR, entry.name, 'project.json'));
      } catch { continue; }
      if (!project) continue;
      if (projectId && project.id !== projectId) continue;

      const runsDir = join(DATA_DIR, entry.name, 'runs');
      let runEntries = [];
      try {
        runEntries = await readdir(runsDir, { withFileTypes: true });
      } catch { continue; }

      for (const runEntry of runEntries) {
        if (!runEntry.isDirectory()) continue;
        const runFile = join(runsDir, runEntry.name, 'run.json');
        let run = null;
        try { run = await readJSON(runFile); } catch { continue; }
        if (!run) continue;

        if (fromDate && new Date(run.startedAt) < fromDate) continue;
        if (toDate   && new Date(run.startedAt) > toDate)   continue;

        const steps = (run.steps || []).map(s => ({
          agentId:   s.agentId   || s.id || '',
          agentName: s.agentName || s.name || '',
          agentType: s.agentType || s.type || '',
          status:    s.status    || 'unknown',
          usage:     s.usage || null,
        }));

        const totalUsage = run.totalUsage || steps.reduce(
          (acc, s) => ({
            inputTokens:      acc.inputTokens      + (s.usage?.inputTokens      || 0),
            outputTokens:     acc.outputTokens     + (s.usage?.outputTokens     || 0),
            estimatedCostUsd: acc.estimatedCostUsd + (s.usage?.estimatedCostUsd || 0),
          }),
          { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 }
        );

        runs.push({
          runId:       run.id || runEntry.name,
          projectId:   project.id,
          projectName: project.name,
          storyKey:    run.storyKey || run.jiraStory || '',
          startedAt:   run.startedAt  || null,
          finishedAt:  run.finishedAt || null,
          agentCount:  steps.length,
          status:      run.status || 'unknown',
          steps,
          totalUsage,
        });
      }
    }

    runs.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

    const aggregate = runs.reduce(
      (acc, r) => ({
        totalInputTokens:      acc.totalInputTokens      + (r.totalUsage?.inputTokens      || 0),
        totalOutputTokens:     acc.totalOutputTokens     + (r.totalUsage?.outputTokens     || 0),
        totalEstimatedCostUsd: acc.totalEstimatedCostUsd + (r.totalUsage?.estimatedCostUsd || 0),
        runCount:              acc.runCount + 1,
      }),
      { totalInputTokens: 0, totalOutputTokens: 0, totalEstimatedCostUsd: 0, runCount: 0 }
    );
    aggregate.totalEstimatedCostUsd = parseFloat(aggregate.totalEstimatedCostUsd.toFixed(6));

    res.json({ runs, aggregate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/status', (req, res) => {


  res.json({
    status: 'ok',
    version: '1.0.0',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// ─── Projects ─────────────────────────────────────────────────────────────────

app.get('/api/projects', async (req, res) => {
  try {
    const entries = await readdir(DATA_DIR, { withFileTypes: true }).catch(() => []);
    const projects = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const p = await getProject(entry.name);
      if (p) projects.push(p);
    }
    projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { name, description, git, jira: jiraConfig, confluence: confluenceConfig } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Project name is required' });

    // Build a unique folder name from the project name
    const existingFolders = await readdir(DATA_DIR, { withFileTypes: true })
      .then(e => e.filter(x => x.isDirectory()).map(x => x.name))
      .catch(() => []);
    let folderSlug = slugify(name.trim());
    let suffix = 2;
    while (existingFolders.includes(folderSlug)) {
      folderSlug = `${slugify(name.trim())}-${suffix++}`;
    }

    const project = {
      id: uuidv4(),
      name: name.trim(),
      dataFolder: folderSlug,
      description: description || '',
      git: {
        repoUrl: git?.repoUrl || '',
        owner: git?.owner || '',
        repo: git?.repo || '',
        branch: git?.branch || 'main',
        token: git?.token || ''
      },
      jira: {
        url: jiraConfig?.url || '',
        email: jiraConfig?.email || '',
        token: jiraConfig?.token || '',
        projectKey: jiraConfig?.projectKey || ''
      },
      confluence: {
        url: confluenceConfig?.url || '',
        email: confluenceConfig?.email || '',
        token: confluenceConfig?.token || '',
        spaceKey: confluenceConfig?.spaceKey || ''
      },
      agents: [],
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await saveProject(project);
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { name, description, git, jira: jiraConfig, confluence: confluenceConfig } = req.body;
    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    if (git) project.git = { ...project.git, ...git };
    if (jiraConfig) project.jira = { ...project.jira, ...jiraConfig };
    if (confluenceConfig) project.confluence = { ...project.confluence, ...confluenceConfig };

    project.status = computeStatus(project);
    project.updatedAt = new Date().toISOString();

    await saveProject(project);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    await rm(projectDir(project), { recursive: true, force: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Connection Tests ─────────────────────────────────────────────────────────

app.post('/api/projects/:id/test-connection/:type', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { type } = req.params;
    let result;

    if (type === 'github') result = await github.testConnection(project.git);
    else if (type === 'jira') result = await jira.testConnection(project.jira);
    else if (type === 'confluence') result = await confluence.testConnection(project.confluence);
    else return res.status(400).json({ error: 'Unknown connection type' });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Agents ───────────────────────────────────────────────────────────────────

app.post('/api/projects/:id/agents', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { name, type, templateType, customInstructions, masterTemplate, systemPromptTemplate, userPrompt } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Agent name is required' });
    if (!type) return res.status(400).json({ error: 'Agent type is required' });
    if (!AGENT_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid agent type. Must be one of: ${AGENT_TYPES.join(', ')}` });
    }

    const agent = {
      id: uuidv4(),
      name: name.trim(),
      type,
      templateType: templateType || type,
      masterTemplate: masterTemplate || '',
      systemPromptTemplate: systemPromptTemplate || '',
      userPrompt: userPrompt || '',
      customInstructions: customInstructions || '',
      configured: true,
      order: project.agents.length,
      createdAt: new Date().toISOString()
    };

    project.agents.push(agent);
    project.status = computeStatus(project);
    project.updatedAt = new Date().toISOString();

    await saveProject(project);
    res.status(201).json({ project, agent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/projects/:id/agents/:agentId', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const idx = project.agents.findIndex(a => a.id === req.params.agentId);
    if (idx === -1) return res.status(404).json({ error: 'Agent not found' });

    const { name, type, templateType, customInstructions, masterTemplate, systemPromptTemplate, userPrompt, order } = req.body;
    const agent = project.agents[idx];

    if (name !== undefined) agent.name = name;
    if (type !== undefined) {
      if (!AGENT_TYPES.includes(type)) {
        return res.status(400).json({ error: `Invalid agent type` });
      }
      agent.type = type;
    }
    if (templateType !== undefined) agent.templateType = templateType;
    if (masterTemplate !== undefined) agent.masterTemplate = masterTemplate;
    if (systemPromptTemplate !== undefined) agent.systemPromptTemplate = systemPromptTemplate;
    if (userPrompt !== undefined) agent.userPrompt = userPrompt;
    if (customInstructions !== undefined) agent.customInstructions = customInstructions;
    if (order !== undefined) agent.order = order;
    agent.configured = true;
    agent.updatedAt = new Date().toISOString();

    project.agents[idx] = agent;
    project.status = computeStatus(project);
    project.updatedAt = new Date().toISOString();

    await saveProject(project);
    res.json({ project, agent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id/agents/:agentId', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    project.agents = project.agents.filter(a => a.id !== req.params.agentId);
    project.agents.forEach((a, i) => (a.order = i));
    project.status = computeStatus(project);
    project.updatedAt = new Date().toISOString();

    await saveProject(project);
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/projects/:id/agents/reorder', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { agentIds } = req.body;
    if (!Array.isArray(agentIds)) return res.status(400).json({ error: 'agentIds must be an array' });

    project.agents.sort((a, b) => agentIds.indexOf(a.id) - agentIds.indexOf(b.id));
    project.agents.forEach((a, i) => (a.order = i));
    project.updatedAt = new Date().toISOString();

    await saveProject(project);
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Templates ────────────────────────────────────────────────────────────────

app.get('/api/templates', async (req, res) => {
  try {
    const templates = [];
    for (const type of AGENT_TYPES) {
      const dir = join(TEMPLATES_DIR, type);
      let systemPrompt = '';
      let instructions = '';
      try { systemPrompt = await readFile(join(dir, 'system-prompt.md'), 'utf-8'); } catch {}
      try { instructions = await readFile(join(dir, 'instructions.md'), 'utf-8'); } catch {}
      templates.push({ type, systemPrompt, instructions });
    }
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/templates/:type', async (req, res) => {
  try {
    const { type } = req.params;
    if (!AGENT_TYPES.includes(type)) return res.status(404).json({ error: 'Template not found' });

    const dir = join(TEMPLATES_DIR, type);
    let systemPrompt = '';
    let instructions = '';
    try { systemPrompt = await readFile(join(dir, 'system-prompt.md'), 'utf-8'); } catch {}
    try { instructions = await readFile(join(dir, 'instructions.md'), 'utf-8'); } catch {}

    res.json({ type, systemPrompt, instructions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/templates/:type/:file', async (req, res) => {
  try {
    const { type, file } = req.params;
    if (!AGENT_TYPES.includes(type)) return res.status(404).json({ error: 'Template type not found' });
    if (!['system-prompt', 'instructions'].includes(file)) {
      return res.status(400).json({ error: 'File must be system-prompt or instructions' });
    }

    const { content } = req.body;
    if (content === undefined) return res.status(400).json({ error: 'content is required' });

    const dir = join(TEMPLATES_DIR, type);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${file}.md`), content, 'utf-8');

    res.json({ success: true, type, file });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Custom Templates ─────────────────────────────────────────────────────────

const CUSTOM_TEMPLATES_FILE = join(DATA_DIR, 'custom-templates.json');

async function readCustomTemplates() {
  const data = await readJSON(CUSTOM_TEMPLATES_FILE);
  return Array.isArray(data) ? data : [];
}

async function saveCustomTemplates(templates) {
  await writeJSON(CUSTOM_TEMPLATES_FILE, templates);
}

app.get('/api/custom-templates', async (req, res) => {
  try {
    const templates = await readCustomTemplates();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/custom-templates', async (req, res) => {
  try {
    const { name, templateType, instructions, systemPrompt } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Template name is required' });
    if (!['master', 'system-prompt'].includes(templateType)) {
      return res.status(400).json({ error: 'templateType must be master or system-prompt' });
    }
    if (templateType === 'master' && !instructions?.trim()) {
      return res.status(400).json({ error: 'Instructions content is required for master templates' });
    }
    if (templateType === 'system-prompt' && !systemPrompt?.trim()) {
      return res.status(400).json({ error: 'System prompt content is required' });
    }

    const templates = await readCustomTemplates();
    const template = {
      id: uuidv4(),
      name: name.trim(),
      templateType,
      instructions: instructions?.trim() || '',
      systemPrompt: systemPrompt?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    templates.push(template);
    await saveCustomTemplates(templates);
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/custom-templates/:id', async (req, res) => {
  try {
    const templates = await readCustomTemplates();
    const idx = templates.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Custom template not found' });

    const { name, instructions, systemPrompt } = req.body;
    if (name !== undefined) templates[idx].name = name.trim();
    if (instructions !== undefined) templates[idx].instructions = instructions.trim();
    if (systemPrompt !== undefined) templates[idx].systemPrompt = systemPrompt.trim();
    templates[idx].updatedAt = new Date().toISOString();

    await saveCustomTemplates(templates);
    res.json(templates[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/custom-templates/:id', async (req, res) => {
  try {
    const templates = await readCustomTemplates();
    const filtered = templates.filter(t => t.id !== req.params.id);
    if (filtered.length === templates.length) {
      return res.status(404).json({ error: 'Custom template not found' });
    }
    await saveCustomTemplates(filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Runs ─────────────────────────────────────────────────────────────────────

app.get('/api/projects/:id/runs', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const runsDir = join(projectDir(project), 'runs');
    const files = await readdir(runsDir).catch(() => []);
    const runs = [];
    for (const f of files.filter(f => f.endsWith('.json'))) {
      const run = await readJSON(join(runsDir, f));
      if (run) runs.push(run);
    }
    runs.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:id/runs/:runId', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const run = await readJSON(
      join(projectDir(project), 'runs', `${req.params.runId}.json`)
    );
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Stories ──────────────────────────────────────────────────────────────────

app.post('/api/projects/:id/stories', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { key, summary, description, source } = req.body;
    if (!summary?.trim()) return res.status(400).json({ error: 'Story summary is required' });

    const story = {
      id: uuidv4(),
      key: key?.trim() || '',
      summary: summary.trim(),
      description: description?.trim() || '',
      source: source || 'manual',
      createdAt: new Date().toISOString()
    };

    if (!project.stories) project.stories = [];

    const duplicate = project.stories.find(s =>
      key?.trim() ? s.key === key.trim() : s.summary.toLowerCase() === summary.trim().toLowerCase()
    );
    if (duplicate) return res.status(409).json({ error: `Story ${key?.trim() || `"${summary.trim()}"`} is already in this project.` });

    project.stories.push(story);
    project.updatedAt = new Date().toISOString();

    await saveProject(project);
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id/stories/:storyId', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (!project.stories) project.stories = [];
    project.stories = project.stories.filter(s => s.id !== req.params.storyId);
    project.updatedAt = new Date().toISOString();

    await saveProject(project);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:id/jira-stories', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (!project.jira?.url || !project.jira?.token) {
      return res.status(400).json({ error: 'Jira not configured for this project' });
    }

    const stories = await jira.getStoriesInSprint(project.jira, project.jira.projectKey);
    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Single-Agent Execution (SSE) ─────────────────────────────────────────────

app.post('/api/projects/:id/run-agent', async (req, res) => {
  const { agentId, storyKey, previousContext } = req.body;

  if (!agentId) return res.status(400).json({ error: 'agentId is required' });
  if (!storyKey?.trim()) return res.status(400).json({ error: 'storyKey is required' });

  const project = await getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const agent = project.agents.find(a => a.id === agentId);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  // Set up SSE stream
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const emit = (event, data) => {
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
  };

  let clientGone = false;
  req.on('close', () => { clientGone = true; });

  const safeEmit = (event, data) => { if (!clientGone) emit(event, data); };

  try {
    const output = await runSingleAgent(
      agent, project, storyKey.trim(), previousContext || [],
      (event, data) => safeEmit(event, data)
    );

    safeEmit('complete', {
      agentId,
      agentType: agent.type,
      output,
      completedAt: new Date().toISOString()
    });
  } catch (err) {
    safeEmit('error', { agentId, error: err.message });
  }

  res.end();
});

// ─── Pipeline Execution (SSE) ─────────────────────────────────────────────────

app.post('/api/projects/:id/run', async (req, res) => {
  const { jiraStory } = req.body;

  if (!jiraStory?.trim()) {
    return res.status(400).json({ error: 'Jira story number is required' });
  }

  const project = await getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (project.agents.length === 0) {
    return res.status(400).json({ error: 'No agents configured. Please add agents before running.' });
  }

  const unconfigured = project.agents.filter(a => !a.configured);
  if (unconfigured.length > 0) {
    return res.status(400).json({
      error: `Agents not configured: ${unconfigured.map(a => a.name).join(', ')}`
    });
  }

  // Set up SSE stream
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const emit = (event, data) => {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {}
  };

  // Create run record
  const runId = uuidv4();
  const sortedAgents = [...project.agents].sort((a, b) => a.order - b.order);
  const run = {
    id: runId,
    projectId: project.id,
    projectName: project.name,
    jiraStory: jiraStory.trim(),
    status: 'running',
    startedAt: new Date().toISOString(),
    completedAt: null,
    steps: sortedAgents.map(a => ({
      agentId: a.id,
      agentType: a.type,
      agentName: a.name,
      status: 'pending',
      output: '',
      startedAt: null,
      completedAt: null
    })),
    result: null,
    error: null
  };

  const runsDir = join(projectDir(project), 'runs');
  await mkdir(runsDir, { recursive: true });
  await writeJSON(join(runsDir, `${runId}.json`), run);

  emit('run_started', {
    runId,
    projectId: project.id,
    jiraStory: jiraStory.trim(),
    totalAgents: sortedAgents.length
  });

  // Handle client disconnect
  let clientGone = false;
  req.on('close', () => { clientGone = true; });

  const safeEmit = (event, data) => {
    if (!clientGone) emit(event, data);
  };

  try {
    await runPipeline(project, jiraStory.trim(), run, safeEmit);

    run.status = 'completed';
    run.completedAt = new Date().toISOString();
    await writeJSON(join(runsDir, `${runId}.json`), run);

    safeEmit('run_complete', {
      runId,
      status: 'completed',
      completedAt: run.completedAt
    });

  } catch (err) {
    run.status = 'failed';
    run.completedAt = new Date().toISOString();
    run.error = err.message;
    await writeJSON(join(runsDir, `${runId}.json`), run);

    safeEmit('run_error', {
      runId,
      status: 'failed',
      error: err.message
    });
  }

  res.end();
});

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🤖 Agent AI Squad Backend`);
  console.log(`   Running at: http://localhost:${PORT}`);
  console.log(`   Data dir:   ${DATA_DIR}`);
  console.log(`   Templates:  ${TEMPLATES_DIR}\n`);
});
