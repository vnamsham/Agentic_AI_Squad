// Agent Pipeline Orchestrator
// Runs agents sequentially: Lead → Developer → Tester → Regression → Lead (PR)

import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile, mkdir, access, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import * as github from '../connectors/github.js';
import * as jira from '../connectors/jira.js';
import * as confluence from '../connectors/confluence.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');
const DATA_DIR = join(__dirname, '..', 'data');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Template Loader ────────────────────────────────────────────────────────

async function loadTemplate(templateType) {
  let systemPrompt = '';
  let instructions = '';
  try {
    systemPrompt = await readFile(
      join(TEMPLATES_DIR, templateType, 'system-prompt.md'), 'utf-8'
    );
  } catch {
    systemPrompt = `You are a ${templateType} agent in a software development pipeline.`;
  }
  try {
    instructions = await readFile(
      join(TEMPLATES_DIR, templateType, 'instructions.md'), 'utf-8'
    );
  } catch {
    instructions = '';
  }
  return { systemPrompt, instructions };
}

// ─── Context Gatherers ───────────────────────────────────────────────────────

async function gatherJiraContext(project, jiraStory) {
  if (!jira.isConfigured(project.jira)) {
    return `Jira Story: ${jiraStory}\n(Jira not configured — no story details available)`;
  }
  try {
    const story = await jira.getStory(project.jira, jiraStory);
    return `## Jira Story: ${story.key}
**Summary:** ${story.summary}
**Type:** ${story.type}
**Status:** ${story.status}
**Priority:** ${story.priority}
**Reporter:** ${story.reporter}
**Assignee:** ${story.assignee || 'Unassigned'}
**Sprint:** ${story.sprint || 'No sprint'}
**Epic:** ${story.epicLink || 'None'}
**Labels:** ${story.labels.join(', ') || 'None'}
**URL:** ${story.url}

### Description
${story.description || 'No description provided.'}

### Acceptance Criteria
${story.acceptanceCriteria || 'No acceptance criteria defined.'}`;
  } catch (err) {
    return `Jira Story: ${jiraStory}\nFailed to fetch story details: ${err.message}`;
  }
}

async function gatherConfluenceContext(project) {
  if (!confluence.isConfigured(project.confluence)) {
    return '(Confluence not configured — no documentation available)';
  }
  try {
    const pages = await confluence.getSpacePages(
      project.confluence, project.confluence.spaceKey, 5
    );
    if (!pages.length) return '(No Confluence pages found)';
    const summaries = pages.map(p => `- ${p.title}: ${p.url}`).join('\n');
    return `## Confluence Documentation\nRecent pages in space ${project.confluence.spaceKey}:\n${summaries}`;
  } catch (err) {
    return `(Confluence fetch failed: ${err.message})`;
  }
}

async function gatherGitContext(project) {
  if (!github.isConfigured(project.git)) {
    return `Repository: ${project.git?.repoUrl || 'Not configured'}\n(GitHub not configured)`;
  }
  try {
    const [info, tree] = await Promise.all([
      github.getRepoInfo(project.git),
      github.getRepoTree(project.git, project.git.branch || 'main')
    ]);
    const fileList = tree.slice(0, 80).join('\n');
    return `## Git Repository: ${info.full_name}
**Default Branch:** ${info.default_branch}
**Description:** ${info.description || 'No description'}
**Language:** ${info.language}
**URL:** ${info.html_url}

### Repository File Structure (top 80 files)
\`\`\`
${fileList}
\`\`\``;
  } catch (err) {
    return `Repository: ${project.git?.repoUrl}\n(Git fetch failed: ${err.message})`;
  }
}

// ─── Claude Streaming Call ───────────────────────────────────────────────────

async function callClaude(systemPrompt, userMessage, onToken) {
  const stream = anthropic.messages.stream({
    model: process.env.CLAUDE_MODEL || 'claude-opus-4-6',
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });

  let fullResponse = '';


  const stream = anthropic.messages.stream({
    model: process.env.CLAUDE_MODEL || 'claude-opus-4-6',
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });

  let fullResponse = '';

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta?.type === 'text_delta'
    ) {
      const token = event.delta.text;
      fullResponse += token;
      onToken(token);
    }
  }

  return fullResponse;
}

// ─── File Parser & Saver ─────────────────────────────────────────────────────

async function parseAndSaveFiles(output, project, runId, emit) {
  const fileRegex = /<generated_file path="([^"]+)">([\s\S]*?)<\/generated_file>/g;
  const files = [];
  let match;

  while ((match = fileRegex.exec(output)) !== null) {
    files.push({ path: match[1].trim(), content: match[2].replace(/^\n/, '').replace(/\n$/, '') });
  }

  if (files.length === 0) {
    emit('pipeline_log', { message: 'Developer Agent: No <generated_file> blocks found in output — skipping file save.' });
    return [];
  }

  const projectFolder = project.dataFolder || project.id;
  const baseDir = runId
    ? join(DATA_DIR, projectFolder, 'runs', runId, 'generated-code')
    : join(DATA_DIR, projectFolder, 'generated-code');

  // Clean up previous run before saving new files
  await rm(baseDir, { recursive: true, force: true });
  await mkdir(baseDir, { recursive: true });

  const saved = [];
  for (const file of files) {
    const filePath = join(baseDir, ...file.path.split('/'));
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content, 'utf-8');
    saved.push(file.path);
    emit('pipeline_log', { message: `✓ File saved: ${file.path}` });
  }

  emit('pipeline_log', { message: `Developer Agent: ${saved.length} file(s) written to generated-code/` });
  return saved;
}

// ─── Code Executor ───────────────────────────────────────────────────────────

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function runCommand(cmd, args, cwd, logFn, timeoutMs = 120_000) {
  return new Promise((resolve) => {
    logFn(`$ ${cmd} ${args.join(' ')}`);
    const proc = spawn(cmd, args, {
      cwd, shell: true,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });
    let output = '';
    let settled = false;

    const done = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, output });
    };

    const timer = setTimeout(() => {
      if (!settled) {
        logFn(`⚠ Command timed out after ${timeoutMs / 1000}s — killing process`);
        proc.kill('SIGKILL');
        done(-1);
      }
    }, timeoutMs);

    const handleData = (data) => {
      const text = data.toString().replace(ANSI_RE, '');
      output += text;
      text.split('\n').filter(l => l.trim()).forEach(line => logFn(line));
    };

    proc.stdout.on('data', handleData);
    proc.stderr.on('data', handleData);
    proc.on('close', (code) => done(code));
    proc.on('error', (err) => { output += err.message; done(-1); });
  });
}

function findProjectRoot(savedFiles, baseDir) {
  // Prefer the directory containing requirements.txt (Python) or package.json (Node)
  for (const marker of ['requirements.txt', 'package.json']) {
    const found = savedFiles.find(f => f.endsWith(marker));
    if (found) {
      const dir = found.includes('/') ? found.substring(0, found.lastIndexOf('/')) : '';
      const lang = marker === 'requirements.txt' ? 'python' : 'node';
      return { root: dir ? join(baseDir, ...dir.split('/')) : baseDir, lang };
    }
  }
  if (savedFiles.some(f => f.endsWith('.py'))) return { root: baseDir, lang: 'python' };
  if (savedFiles.some(f => f.endsWith('.js'))) return { root: baseDir, lang: 'node' };
  return { root: baseDir, lang: 'unknown' };
}

async function fileExists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

async function loadTestResults(baseDir) {
  try {
    const raw = await readFile(join(baseDir, 'test-report.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatTestResults(testResults) {
  if (!testResults) return '(No test results available)';
  const s = testResults.summary || {};
  const lines = [
    '## Pytest Execution Results',
    `- **Total:** ${s.total || 0} | **Passed:** ${s.passed || 0} | **Failed:** ${s.failed || 0} | **Skipped:** ${s.skipped || 0}`,
    `- **Duration:** ${(testResults.duration || 0).toFixed(2)}s`,
    `- **Overall:** ${(s.failed || 0) === 0 ? '✓ ALL TESTS PASSED' : `✗ ${s.failed} TEST(S) FAILED`}`,
    '',
    '### Individual Test Results',
    ''
  ];
  (testResults.tests || []).forEach(test => {
    const status = test.outcome === 'passed' ? '✓ PASS' : test.outcome === 'failed' ? '✗ FAIL' : '⚠ SKIP';
    const duration = ((test.call?.duration || 0) * 1000).toFixed(0);
    lines.push(`- ${status} | \`${test.nodeid}\` | ${duration}ms`);
    if (test.outcome === 'failed') {
      const err = (test.call?.longrepr || test.setup?.longrepr || '').split('\n').slice(0, 5).join('\n  ');
      if (err) lines.push(`  **Error:**\n  ${err}`);
    }
  });
  return lines.join('\n');
}

async function createTestExcel(testResults, project, storyKey, baseDir, emit) {
  const log = (message) => emit('pipeline_log', { message });
  if (!testResults) {
    log('⚠ No test results available — skipping Excel report generation');
    return null;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Agentic AI Squad';
  workbook.created = new Date();

  // ── Summary Sheet ──────────────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Field', key: 'field', width: 30 },
    { header: 'Value', key: 'value', width: 45 }
  ];
  const hdrRow = summarySheet.getRow(1);
  hdrRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hdrRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

  const s = testResults.summary || {};
  const passed = s.passed || 0;
  const failed = s.failed || 0;
  const overall = failed === 0 ? 'PASS' : 'FAIL';
  summarySheet.addRows([
    { field: 'Project',         value: project.name },
    { field: 'Jira Story',      value: storyKey },
    { field: 'Execution Date',  value: new Date().toLocaleString() },
    { field: 'Total Tests',     value: s.total || 0 },
    { field: 'Passed',          value: passed },
    { field: 'Failed',          value: failed },
    { field: 'Skipped',         value: s.skipped || 0 },
    { field: 'Duration (s)',    value: parseFloat((testResults.duration || 0).toFixed(2)) },
    { field: 'Overall Status',  value: overall }
  ]);
  const statusCell = summarySheet.getCell(`B${summarySheet.rowCount}`);
  statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: overall === 'PASS' ? 'FF00B050' : 'FFFF0000' } };
  statusCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // ── Test Cases Sheet ───────────────────────────────────────────────────────
  const tcSheet = workbook.addWorksheet('Test Cases');
  tcSheet.columns = [
    { header: '#',             key: 'id',       width: 6  },
    { header: 'Test Name',     key: 'name',     width: 55 },
    { header: 'Module / File', key: 'module',   width: 35 },
    { header: 'Status',        key: 'status',   width: 12 },
    { header: 'Duration (ms)', key: 'duration', width: 16 },
    { header: 'Error / Notes', key: 'error',    width: 65 }
  ];
  const tcHdr = tcSheet.getRow(1);
  tcHdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  tcHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  tcHdr.alignment = { horizontal: 'center' };

  (testResults.tests || []).forEach((test, i) => {
    const outcome = test.outcome === 'passed' ? 'PASS' : test.outcome === 'failed' ? 'FAIL' : 'SKIP';
    const parts = (test.nodeid || '').split('::');
    const row = tcSheet.addRow({
      id:       i + 1,
      name:     parts.slice(1).join(' > ') || test.nodeid,
      module:   parts[0] || '',
      status:   outcome,
      duration: Math.round((test.call?.duration || 0) * 1000),
      error:    (test.call?.longrepr || test.setup?.longrepr || '').substring(0, 250)
    });
    const sc = row.getCell('status');
    const colors = { PASS: 'FF00B050', FAIL: 'FFFF0000', SKIP: 'FFFFC000' };
    sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors[outcome] } };
    sc.font = { bold: true, color: { argb: outcome === 'SKIP' ? 'FF000000' : 'FFFFFFFF' } };
    sc.alignment = { horizontal: 'center' };
    row.getCell('error').alignment = { wrapText: true };
  });

  const excelPath = join(baseDir, 'test-cases.xlsx');
  await workbook.xlsx.writeFile(excelPath);
  log(`📊 Excel test report saved: test-cases.xlsx (${(testResults.tests || []).length} test cases)`);
  return excelPath;
}

async function executeGeneratedCode(savedFiles, baseDir, emit) {
  const logLines = [];
  const log = (message) => { logLines.push(message); emit('pipeline_log', { message }); };
  let testResults = null;

  log('──────────────────────────────────────');
  log('▶ Executing generated code...');

  const { root, lang } = findProjectRoot(savedFiles, baseDir);
  log(`Detected language: ${lang} | Root: ${root}`);

  if (lang === 'python') {
    const PIP_TRUSTED = ['--trusted-host', 'pypi.org', '--trusted-host', 'files.pythonhosted.org', '--trusted-host', 'pypi.python.org'];

    if (await fileExists(join(root, 'requirements.txt'))) {
      log('📦 Installing Python dependencies...');
      const install = await runCommand('py', ['-m', 'pip', 'install', '-r', 'requirements.txt', '-q', '--disable-pip-version-check', ...PIP_TRUSTED], root, log);
      if (install.code !== 0) { log('✗ Dependency installation failed.'); return; }
      log('✓ Dependencies installed.');
    }

    const hasTests = savedFiles.some(f => f.includes('test') && f.endsWith('.py'));
    let jsonReportAvailable = false;
    if (hasTests) {
      const depsMarker = join(DATA_DIR, '.pytest-deps-ready');
      if (!await fileExists(depsMarker)) {
        const pytestCheck = await runCommand('py', ['-m', 'pytest', '--version'], root, log);
        if (pytestCheck.code !== 0) {
          log('📦 Installing pytest...');
          await runCommand('py', ['-m', 'pip', 'install', 'pytest', '-q', '--disable-pip-version-check', ...PIP_TRUSTED], root, log);
        }
        const jsonReportCheck = await runCommand('py', ['-m', 'pip', 'show', 'pytest-json-report', '-q'], root, log);
        if (jsonReportCheck.code !== 0) {
          log('📦 Installing pytest-json-report...');
          const installed = await runCommand('py', ['-m', 'pip', 'install', 'pytest-json-report', '-q', '--disable-pip-version-check', ...PIP_TRUSTED], root, log);
          jsonReportAvailable = installed.code === 0;
        } else {
          jsonReportAvailable = true;
        }
        if (jsonReportAvailable) {
          await writeFile(depsMarker, new Date().toISOString(), 'utf-8');
          log('✓ Python test dependencies ready.');
        } else {
          log('⚠ pytest-json-report unavailable — running tests without JSON report.');
        }
      } else {
        jsonReportAvailable = true;
      }
    }

    const WEB_FRAMEWORKS = ['flask', 'fastapi', 'django', 'uvicorn', 'starlette'];

    const pyFiles = savedFiles.filter(f => f.endsWith('.py') && !f.includes('test'));
    for (const f of pyFiles) {
      const fullPath = join(baseDir, ...f.split('/'));
      const check = await runCommand('py', ['-m', 'py_compile', fullPath], root, log);
      if (check.code !== 0) { log(`✗ Syntax error in ${f}`); return; }
      log(`✓ Syntax OK: ${f}`);

      // Run standalone scripts directly (skip web apps — they'd hang)
      const source = await readFile(fullPath, 'utf-8');
      const isStandalone = source.includes('if __name__');
      const isWebApp = WEB_FRAMEWORKS.some(fw => source.toLowerCase().includes(`import ${fw}`) || source.toLowerCase().includes(`from ${fw}`));

      if (isStandalone && !isWebApp) {
        log(`▶ Running ${f}...`);
        const run = await runCommand('py', ['-u', fullPath], root, log);
        // Fallback: explicitly print captured output in case streaming was buffered
        if (run.output.trim()) {
          log('📤 Output:');
          run.output.trim().split('\n')
            .filter(l => l.trim())
            .forEach(line => log(`   ${line.replace(ANSI_RE, '')}`));
        }
        if (run.code !== 0) {
          log(`✗ Script exited with error (code ${run.code})`);
        } else {
          log(`✓ Script completed successfully.`);
        }
      }
    }

    if (hasTests) {
      log('🧪 Running pytest...');
      const pytestArgs = ['-m', 'pytest', '-v', '-s', '--tb=short', '--color=no'];
      if (jsonReportAvailable) pytestArgs.push('--json-report', '--json-report-file=test-report.json');
      const result = await runCommand('py', pytestArgs, root, log);
      log(result.code === 0 ? '✓ All tests passed!' : `✗ Some tests failed (exit code ${result.code})`);
      if (jsonReportAvailable) {
        try {
          const raw = await readFile(join(root, 'test-report.json'), 'utf-8');
          testResults = JSON.parse(raw);
          const sr = testResults.summary || {};
          log(`📊 Test results: ${sr.passed || 0} passed, ${sr.failed || 0} failed, ${sr.total || 0} total`);
        } catch {
          log('⚠ Could not parse test report JSON');
        }
      }
    } else {
      log('⚠ No test files found — skipping test run.');
    }

  } else if (lang === 'node') {
    if (await fileExists(join(root, 'package.json'))) {
      log('📦 Installing Node dependencies...');
      const install = await runCommand('npm', ['install', '--silent'], root, log);
      if (install.code !== 0) { log('✗ npm install failed.'); return; }
      log('✓ Dependencies installed.');
    }

    const pkgPath = join(root, 'package.json');
    if (await fileExists(pkgPath)) {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
      if (pkg.scripts?.test) {
        log('🧪 Running npm test...');
        const result = await runCommand('npm', ['test'], root, log);
        log(result.code === 0 ? '✓ All tests passed!' : `✗ Some tests failed (exit code ${result.code})`);
      }
    }

  } else {
    log('⚠ Unknown language — skipping execution.');
  }

  log('──────────────────────────────────────');

  // Save execution log to disk
  const logPath = join(baseDir, 'execution-log.txt');
  await writeFile(logPath, logLines.join('\n'), 'utf-8');

  return { testResults };
}

// ─── Pipeline Runner ─────────────────────────────────────────────────────────

export async function runPipeline(project, jiraStory, run, emit) {
  const sortedAgents = [...project.agents].sort((a, b) => a.order - b.order);

  // Pre-gather shared context
  emit('pipeline_log', { message: 'Gathering project context from Jira, Confluence, and Git...' });
  const [jiraContext, confluenceContext, gitContext] = await Promise.all([
    gatherJiraContext(project, jiraStory),
    gatherConfluenceContext(project),
    gatherGitContext(project)
  ]);

  const sharedContext = `# Project: ${project.name}

${jiraContext}

${confluenceContext}

${gitContext}`;

  emit('pipeline_log', { message: 'Context gathered. Starting agent pipeline...' });

  // Track context passed between agents
  let pipelineContext = {
    jiraStory,
    sharedContext,
    previousOutputs: {}
  };

  let finalResult = null;

  // Execute each agent in order
  for (let i = 0; i < sortedAgents.length; i++) {
    const agent = sortedAgents[i];
    const stepIndex = run.steps.findIndex(s => s.agentId === agent.id);

    emit('step_start', {
      agentId: agent.id,
      agentName: agent.name,
      agentType: agent.type,
      stepIndex,
      status: 'running',
      startedAt: new Date().toISOString()
    });

    try {
      const output = await runAgent(agent, pipelineContext, emit);

      // Store output in pipeline context for next agent
      pipelineContext.previousOutputs[agent.type] = {
        agentName: agent.name,
        agentType: agent.type,
        output
      };

      emit('step_complete', {
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.type,
        stepIndex,
        status: 'completed',
        output,
        completedAt: new Date().toISOString()
      });

      // After developer agent: save files then execute them
      if (agent.type === 'developer-agent') {
        const savedFiles = await parseAndSaveFiles(output, project, run.id, emit);
        if (savedFiles.length > 0) {
          const baseDir = join(DATA_DIR, project.dataFolder || project.id, 'runs', run.id, 'generated-code');
          const { testResults } = await executeGeneratedCode(savedFiles, baseDir, emit);
          pipelineContext.testResults = testResults;
          pipelineContext.generatedCodeDir = baseDir;
        }
      }

      // After tester agent: generate Excel test report
      if (agent.type === 'tester-agent' && pipelineContext.testResults && pipelineContext.generatedCodeDir) {
        await createTestExcel(pipelineContext.testResults, project, pipelineContext.jiraStory, pipelineContext.generatedCodeDir, emit);
      }

      // Update run step
      if (run.steps[stepIndex]) {
        run.steps[stepIndex].status = 'completed';
        run.steps[stepIndex].output = output;
        run.steps[stepIndex].completedAt = new Date().toISOString();
      }

      finalResult = output;

    } catch (err) {
      emit('step_error', {
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.type,
        stepIndex,
        status: 'failed',
        error: err.message,
        completedAt: new Date().toISOString()
      });

      if (run.steps[stepIndex]) {
        run.steps[stepIndex].status = 'failed';
        run.steps[stepIndex].error = err.message;
        run.steps[stepIndex].completedAt = new Date().toISOString();
      }

      throw err;
    }
  }

  run.result = { summary: finalResult };
  emit('pipeline_complete', { message: 'All agents completed successfully.', result: finalResult });
}

// ─── Single Agent Runner (exported for step-by-step UI) ──────────────────────

export async function runSingleAgent(agent, project, storyKey, previousContext, emit) {
  // Gather shared context (non-blocking — skip if connectors not configured)
  let jiraCtx = `Jira Story: ${storyKey}`;
  let gitCtx = `Repository: ${project.git?.repoUrl || 'Not configured'}`;
  let confCtx = '(Confluence not configured)';

  try { [jiraCtx, confCtx, gitCtx] = await Promise.all([
    gatherJiraContext(project, storyKey),
    gatherConfluenceContext(project),
    gatherGitContext(project)
  ]); } catch {}

  const sharedContext = `# Project: ${project.name}\n\n${jiraCtx}\n\n${confCtx}\n\n${gitCtx}`;

  // Build previous outputs text from the array passed in from frontend
  const previousOutputsText = (previousContext || [])
    .map(p => `### Output from ${p.agentName} (${p.agentType})\n${p.output}`)
    .join('\n\n---\n\n');

  const pipelineContext = {
    jiraStory: storyKey,
    sharedContext,
    previousOutputs: Object.fromEntries(
      (previousContext || []).map(p => [p.agentType, p])
    )
  };

  const baseDir = join(DATA_DIR, project.dataFolder || project.id, 'generated-code');

  // For tester agent: load existing test results from the previous developer run
  if (agent.type === 'tester-agent') {
    pipelineContext.testResults = await loadTestResults(baseDir);
    pipelineContext.generatedCodeDir = baseDir;
    if (pipelineContext.testResults) {
      emit('pipeline_log', { message: `📊 Loaded existing test results: ${pipelineContext.testResults.summary?.total || 0} tests` });
    }
  }

  const output = await runAgent(agent, pipelineContext, emit, previousOutputsText);

  if (agent.type === 'developer-agent') {
    const savedFiles = await parseAndSaveFiles(output, project, null, emit);
    if (savedFiles.length > 0) {
      const { testResults } = await executeGeneratedCode(savedFiles, baseDir, emit);
      pipelineContext.testResults = testResults;
      pipelineContext.generatedCodeDir = baseDir;
    }
  }

  if (agent.type === 'tester-agent' && pipelineContext.testResults && pipelineContext.generatedCodeDir) {
    await createTestExcel(pipelineContext.testResults, project, storyKey, pipelineContext.generatedCodeDir, emit);
  }

  return output;
}

// ─── Individual Agent Runner ─────────────────────────────────────────────────

async function runAgent(agent, pipelineContext, emit, previousOutputsOverride) {
  const { systemPrompt, instructions } = await loadTemplate(agent.templateType || agent.type);

  // Build the user message combining all context
  const previousOutputsText = previousOutputsOverride !== undefined
    ? previousOutputsOverride
    : Object.values(pipelineContext.previousOutputs)
        .map(p => `### Output from ${p.agentName} (${p.agentType})\n${p.output}`)
        .join('\n\n---\n\n');

  const userMessage = buildAgentMessage(
    agent,
    pipelineContext,
    previousOutputsText,
    instructions
  );

  let fullOutput = '';

  await callClaude(systemPrompt, userMessage, (token) => {
    fullOutput += token;
    emit('step_token', {
      agentId: agent.id,
      agentType: agent.type,
      token
    });
  });

  return fullOutput;
}

// ─── Message Builder ─────────────────────────────────────────────────────────

function buildAgentMessage(agent, pipelineContext, previousOutputsText, instructions) {
  const parts = [];

  // Project context
  parts.push(pipelineContext.sharedContext);

  // Previous agent outputs (if any)
  if (previousOutputsText) {
    parts.push(`\n---\n\n# Previous Agent Outputs\n\n${previousOutputsText}`);
  }

  // Inject actual pytest results for tester agent
  if (agent.type === 'tester-agent' && pipelineContext.testResults) {
    parts.push(`\n---\n\n# Actual Test Execution Results (from automated pytest run)\n\n${formatTestResults(pipelineContext.testResults)}`);
  }

  // Agent-specific instructions from template
  if (instructions) {
    parts.push(`\n---\n\n# Your Instructions\n\n${instructions}`);
  }

  // Custom instructions from agent config
  if (agent.customInstructions?.trim()) {
    parts.push(`\n---\n\n# Additional Custom Instructions\n\n${agent.customInstructions}`);
  }

  // Final task directive
  parts.push(`\n---\n\n# Task\nYou are the **${agent.name}** in the Agent AI Squad pipeline.
Please analyze all the context above and perform your role as defined.
The Jira story to work on is: **${pipelineContext.jiraStory}**

Provide a thorough, structured output that the next agent in the pipeline can use effectively.`);

  return parts.join('\n');
}
