const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { executeLambda } = require('./lambda-runner');
const {
  registerInFloci,
  updateCodeInFloci,
  deleteFromFloci,
  listFromFloci,
  getFunctionFromFloci,
  invokeInFloci,
  getCodeFromFloci,
} = require('./flociLambda');

const app = express();
const PORT = process.env.PORT || 3001;

// Local store for function code (so the UI can retrieve/edit it)
const FUNCTIONS_DIR = path.join(__dirname, 'functions');
if (!fs.existsSync(FUNCTIONS_DIR)) fs.mkdirSync(FUNCTIONS_DIR);

app.use(cors());
app.use(express.json({ limit: '5mb' }));

/* ── Helpers ───────────────────────────────────────────────────────── */
function metaPath(name)  { return path.join(FUNCTIONS_DIR, `${name}.json`); }
function readMeta(name)  {
  try { return JSON.parse(fs.readFileSync(metaPath(name), 'utf8')); }
  catch { return null; }
}
function writeMeta(name, data) {
  fs.writeFileSync(metaPath(name), JSON.stringify(data, null, 2), 'utf8');
}
function deleteMeta(name) {
  try { fs.unlinkSync(metaPath(name)); } catch {}
}

/* ── Health check ──────────────────────────────────────────────────── */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'aws-simulator-backend', version: '2.0.0' });
});

/* ── Admin: reset all backend state ───────────────────────────────── */
app.post('/admin/reset', (req, res) => {
  const files = fs.readdirSync(FUNCTIONS_DIR).filter(f => f.endsWith('.json'));
  files.forEach(f => fs.unlinkSync(path.join(FUNCTIONS_DIR, f)));
  console.log('[admin] State reset — cleared all function metadata');
  res.json({ reset: true, timestamp: new Date().toISOString() });
});

/* ── Lambda: list functions ────────────────────────────────────────── */
app.get('/lambda/functions', async (req, res) => {
  const region = req.query.region || 'ap-south-1';
  try {
    let flociList = [];
    let flociReachable = false;
    try {
      flociList = await listFromFloci(region);
      flociReachable = true;  // Floci responded — trust its result, even if empty
    } catch {
      // Floci is down — fall back to local metadata
    }

    if (flociReachable) {
      // Floci is the source of truth: filter by local region metadata as a second guard
      // (handles case where Floci doesn't scope by region and returns all functions)
      const enriched = flociList
        .filter(fn => {
          const local = readMeta(fn.FunctionName);
          const fnRegion = local?.region || 'ap-south-1';
          return fnRegion === region;
        })
        .map(fn => {
          const local = readMeta(fn.FunctionName);
          return {
            functionName:  fn.FunctionName,
            runtime:       fn.Runtime,
            handler:       fn.Handler,
            description:   fn.Description || '',
            timeout:       fn.Timeout,
            memorySize:    fn.MemorySize,
            envVars:       fn.Environment?.Variables || {},
            lastModified:  fn.LastModified || new Date().toISOString(),
            createdAt:     local?.createdAt || fn.LastModified || new Date().toISOString(),
            code:          local?.code || '',
            region,
          };
        });
      return res.json(enriched);
    }

    // Floci is unreachable — fall back to local files, filter strictly by region
    const files = fs.readdirSync(FUNCTIONS_DIR).filter(f => f.endsWith('.json'));
    const fns = files
      .map(f => readMeta(path.basename(f, '.json')))
      .filter(m => m && (m.region || 'ap-south-1') === region);
    res.json(fns);
  } catch (err) {
    console.error('[lambda] list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── Lambda: get single function ───────────────────────────────────── */
app.get('/lambda/functions/:name', async (req, res) => {
  const { name } = req.params;
  const local = readMeta(name);
  if (!local) return res.status(404).json({ error: `Function "${name}" not found` });

  // Always fetch the live code from Floci so CLI/SDK changes are reflected in the UI
  console.log(`[get-fn] Fetching live code from Floci for ${name} (${local.runtime}, ${local.region || 'ap-south-1'})`);
  const liveCode = await getCodeFromFloci(name, local.runtime, local.region || 'ap-south-1');
  console.log(`[get-fn] getCodeFromFloci result: ${liveCode === null ? 'null (failed)' : `${liveCode.length} chars`}`);

  if (liveCode !== null && liveCode !== local.code) {
    local.code = liveCode;
    writeMeta(name, { ...local, code: liveCode, lastModified: new Date().toISOString() });
    console.log(`[get-fn] Code synced from Floci for ${name}`);
  } else if (liveCode === null) {
    console.log(`[get-fn] Could not fetch from Floci — using cached local code`);
  } else {
    console.log(`[get-fn] Code unchanged`);
  }

  res.json(local);
});

/* ── Lambda: create function ───────────────────────────────────────── */
app.post('/lambda/functions', async (req, res) => {
  const { functionName, runtime, handler, description, timeout, memorySize, envVars, code, region = 'ap-south-1' } = req.body;

  if (!functionName || !runtime || !handler || !code) {
    return res.status(400).json({ error: 'functionName, runtime, handler, and code are required' });
  }
  if (readMeta(functionName)) {
    return res.status(409).json({ error: `Function "${functionName}" already exists` });
  }

  console.log(`[lambda] Creating ${functionName} (${runtime}) in ${region}`);

  try {
    await registerInFloci({ functionName, runtime, handler, code, description, timeout, memorySize, envVars, region });
  } catch (err) {
    console.warn(`[lambda] Floci registration failed (continuing): ${err.message}`);
  }

  const now = new Date().toISOString();
  const meta = { functionName, runtime, handler, description: description || '', timeout: timeout || 3, memorySize: memorySize || 128, envVars: envVars || {}, code, region, createdAt: now, lastModified: now };
  writeMeta(functionName, meta);
  res.status(201).json(meta);
});

/* ── Lambda: update function (code + config) ───────────────────────── */
app.put('/lambda/functions/:name', async (req, res) => {
  const { name } = req.params;
  const existing = readMeta(name);
  if (!existing) return res.status(404).json({ error: `Function "${name}" not found` });

  const updates = req.body;
  const updated = { ...existing, ...updates, functionName: name, lastModified: new Date().toISOString() };

  console.log(`[lambda] Updating ${name}`);

  try {
    if (updates.code || updates.handler || updates.timeout || updates.memorySize || updates.envVars !== undefined) {
      await updateCodeInFloci(name, updated.code, updated.runtime, {
        handler: updated.handler,
        timeout: updated.timeout,
        memorySize: updated.memorySize,
        envVars: updated.envVars,
        description: updated.description,
      }, existing.region || 'ap-south-1');
    }
  } catch (err) {
    console.warn(`[lambda] Floci update failed (continuing): ${err.message}`);
  }

  writeMeta(name, updated);
  res.json(updated);
});

/* ── Lambda: delete function ───────────────────────────────────────── */
app.delete('/lambda/functions/:name', async (req, res) => {
  const { name } = req.params;
  if (!readMeta(name)) return res.status(404).json({ error: `Function "${name}" not found` });

  console.log(`[lambda] Deleting ${name}`);

  const meta = readMeta(name);
  try {
    await deleteFromFloci(name, meta?.region || 'ap-south-1');
  } catch (err) {
    console.warn(`[lambda] Floci delete failed (continuing): ${err.message}`);
  }

  deleteMeta(name);
  res.json({ deleted: true });
});

/* ── CloudWatch Logs helper ────────────────────────────────────────── */
async function fetchCloudWatchLogs(functionName, region) {
  const logGroupName = `/aws/lambda/${functionName}`;
  const date = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const auth = `AWS4-HMAC-SHA256 Credential=test/20260101/${region}/logs/aws4_request, SignedHeaders=host;x-amz-date, Signature=test`;

  async function cwPost(target, body) {
    const res = await fetch('http://localhost:4566/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `Logs_20140328.${target}`,
        'Authorization': auth,
        'X-Amz-Date': date,
      },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  try {
    // Get the most recent log stream
    const streamsData = await cwPost('DescribeLogStreams', {
      logGroupName,
      orderBy: 'LastEventTime',
      descending: true,
      limit: 1,
    });
    const streams = streamsData.logStreams || [];
    if (streams.length === 0) return '';

    // Get log events from that stream
    const eventsData = await cwPost('GetLogEvents', {
      logGroupName,
      logStreamName: streams[0].logStreamName,
      limit: 100,
      startFromHead: true,
    });
    return (eventsData.events || []).map(e => e.message).join('\n');
  } catch (err) {
    console.warn('[invoke] CloudWatch logs fetch failed:', err.message);
    return '';
  }
}

/* ── Lambda: invoke function via Floci (real Lambda runtime) ───────── */
app.post('/lambda/invoke/:name', async (req, res) => {
  const { name } = req.params;
  const { code, event = {} } = req.body;

  const meta = readMeta(name);
  if (!meta) return res.status(404).json({ error: `Function "${name}" not found` });

  const region = meta.region || 'ap-south-1';

  // Push current editor code to Floci before invoking so latest code always runs
  try {
    await updateCodeInFloci(name, code || meta.code, meta.runtime, {}, region);
  } catch (err) {
    console.warn(`[invoke] Floci code update failed: ${err.message}`);
  }

  const invokeStart = Date.now();
  try {
    const { result, logs, functionError } = await invokeInFloci(name, event, region);
    const duration = Date.now() - invokeStart;
    const billedDuration = Math.max(1, Math.ceil(duration));

    // If Floci didn't return logs via Tail header, fetch from CloudWatch
    let finalLogs = logs;
    if (!finalLogs.trim()) {
      await new Promise(r => setTimeout(r, 500));
      finalLogs = await fetchCloudWatchLogs(name, region);
    }

    // Format CloudWatch log lines — strip the leading timestamp+requestId prefix
    // CloudWatch format: "2026-05-19T06:20:52.455Z\t<requestId>\tINFO\tMessage"
    const logLines = finalLogs
      .split('\n')
      .map(l => l.trimEnd())
      .filter(l => l.trim())
      .map(l => {
        // Convert CloudWatch format to readable: keep level + message only
        const cwMatch = l.match(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\t[^\t]+\t(\w+)\t(.+)$/s);
        if (cwMatch) return `[${cwMatch[1]}] ${cwMatch[2]}`;
        return l;
      });

    const memoryUsed = meta.memorySize;
    const succeeded = !functionError;

    console.log(`[invoke] ${name} → ${succeeded ? 'OK' : 'ERROR'} (${duration}ms, ${logLines.length} log lines)`);

    res.json({
      succeeded,
      result:       succeeded ? result : undefined,
      errorMessage: !succeeded ? (result?.errorMessage || JSON.stringify(result)) : undefined,
      errorType:    !succeeded ? (result?.errorType || functionError) : undefined,
      duration,
      billedDuration,
      memoryUsed,
      logs: logLines,
    });
  } catch (err) {
    console.error('[invoke] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── Lambda: execute function (sandbox) ────────────────────────────── */
app.post('/lambda/execute', async (req, res) => {
  const {
    code, runtime = 'nodejs18.x', handler = 'index.handler',
    event = {}, functionName = 'unnamed',
    timeout = 3, memorySize = 128, envVars = {},
  } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'code is required and must be a string' });
  }

  console.log(`[lambda] Executing ${functionName} (${runtime})`);

  try {
    const result = await executeLambda({
      code, runtime, handler, event, functionName,
      timeoutMs: Math.min(timeout * 1000, 30000),
      memorySize, envVars,
    });
    res.json(result);
  } catch (err) {
    console.error('[lambda] Execution error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── Startup: re-register all local functions in Floci ─────────────── */
async function syncFunctionsToFloci() {
  const files = fs.readdirSync(FUNCTIONS_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) return;
  console.log(`[sync] Re-registering ${files.length} function(s) in Floci...`);
  for (const file of files) {
    const meta = readMeta(path.basename(file, '.json'));
    if (!meta || !meta.code) continue;
    try {
      await registerInFloci({
        functionName: meta.functionName,
        runtime:      meta.runtime,
        handler:      meta.handler,
        code:         meta.code,
        description:  meta.description,
        timeout:      meta.timeout,
        memorySize:   meta.memorySize,
        envVars:      meta.envVars,
        region:       meta.region || 'ap-south-1',
      });
      console.log(`[sync] ✓ ${meta.functionName} (${meta.region || 'ap-south-1'})`);
    } catch (err) {
      console.warn(`[sync] ✗ ${meta.functionName}: ${err.message}`);
    }
  }
}

/* ── Start server ──────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`AWS Simulator Backend running on http://localhost:${PORT}`);
  console.log(`  Health:        GET  /health`);
  console.log(`  Lambda list:   GET  /lambda/functions`);
  console.log(`  Lambda create: POST /lambda/functions`);
  console.log(`  Lambda exec:   POST /lambda/execute`);
  setTimeout(syncFunctionsToFloci, 3000);
});
