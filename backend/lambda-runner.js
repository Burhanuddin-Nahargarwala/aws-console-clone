const vm = require('vm');
const { spawnSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

// Windows uses "python", Unix uses "python3"
const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';

/**
 * Execute a Lambda function in an isolated sandbox.
 *
 * Supports:
 *   nodejs18.x / nodejs20.x  — vm.runInNewContext (in-process, fast)
 *   python3.11 / python3.12   — child_process execSync (requires python3 on PATH)
 *
 * Returns:
 *   { result, logs, duration, billedDuration, memoryUsed, initDuration, requestId, error? }
 */
async function executeLambda({ code, runtime, handler, event, functionName, timeoutMs, memorySize, envVars }) {
  const requestId = uuidv4();

  if (runtime.startsWith('nodejs')) {
    return executeNode({ code, handler, event, functionName, timeoutMs, memorySize, envVars, requestId });
  }

  if (runtime.startsWith('python')) {
    return executePython({ code, handler, event, functionName, timeoutMs, memorySize, envVars, requestId });
  }

  throw new Error(`Unsupported runtime: ${runtime}. Supported: nodejs18.x, nodejs20.x, python3.11, python3.12`);
}

/* ── Node.js execution ─────────────────────────────────────────────── */
async function executeNode({ code, handler, event, functionName, timeoutMs, memorySize, envVars, requestId }) {
  const logs = [];
  const startTime = Date.now();

  // Parse handler — default "index.handler" means exports.handler
  const handlerFn = (handler || 'index.handler').split('.').pop();

  // Wrap user code so we can call the named export
  const wrappedCode = `
${code}

// Invoke the handler
(async () => {
  const fn = typeof ${handlerFn} !== 'undefined' ? ${handlerFn} : (exports && exports['${handlerFn}']);
  if (typeof fn !== 'function') throw new Error('Handler "${handlerFn}" is not a function. Make sure you export it correctly.');
  return await fn(__event__, __context__);
})();
`;

  // Mock context object matching real AWS Lambda context
  const context = {
    functionName,
    functionVersion: '$LATEST',
    invokedFunctionArn: `arn:aws:lambda:ap-south-1:000000000000:function:${functionName}`,
    memoryLimitInMB: String(memorySize),
    awsRequestId: requestId,
    logGroupName: `/aws/lambda/${functionName}`,
    logStreamName: `2026/05/18/[$LATEST]${requestId.replace(/-/g, '')}`,
    getRemainingTimeInMillis: () => Math.max(0, timeoutMs - (Date.now() - startTime)),
  };

  // Console mock that captures logs with timestamps (matching CloudWatch format)
  const consoleMock = {
    log:   (...args) => logs.push(`${new Date().toISOString()}\tINFO\t${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`),
    info:  (...args) => logs.push(`${new Date().toISOString()}\tINFO\t${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`),
    warn:  (...args) => logs.push(`${new Date().toISOString()}\tWARN\t${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`),
    error: (...args) => logs.push(`${new Date().toISOString()}\tERROR\t${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`),
  };

  // Sandbox — inject event, context, console, common globals
  const sandbox = {
    console: consoleMock,
    exports: {},
    module: { exports: {} },
    require: safeRequire,
    process: { env: { ...envVars, AWS_REGION: 'ap-south-1', AWS_LAMBDA_FUNCTION_NAME: functionName } },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Promise, JSON, Math, Date, Array, Object, String, Number, Boolean, Error,
    __event__: event,
    __context__: context,
  };

  vm.createContext(sandbox);

  let result;
  let errorObj;

  try {
    const scriptResult = vm.runInContext(wrappedCode, sandbox, { timeout: timeoutMs });
    // The wrapped code returns a Promise — resolve it
    result = await Promise.resolve(scriptResult);
  } catch (err) {
    errorObj = err;
    logs.push(`${new Date().toISOString()}\tERROR\t${err.message}`);
    if (err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
      errorObj = new Error(`Task timed out after ${timeoutMs / 1000}.00 seconds`);
    }
  }

  const duration = Date.now() - startTime;
  const billedDuration = Math.ceil(duration / 100) * 100; // round up to nearest 100ms
  const memoryUsed = Math.floor(memorySize * 0.35 + Math.random() * memorySize * 0.1); // realistic-looking value

  return formatResult({ result, logs, duration, billedDuration, memoryUsed, requestId, functionName, error: errorObj });
}

/* ── Python execution ──────────────────────────────────────────────── */
function executePython({ code, handler, event, functionName, timeoutMs, memorySize, envVars, requestId }) {
  const logs = [];
  const startTime = Date.now();
  const handlerFn = (handler || 'lambda_function.lambda_handler').split('.').pop();

  // Use JSON.stringify for safe injection — no shell-escaping needed since we pass via spawnSync array
  const envLines = Object.entries(envVars)
    .map(([k, v]) => `os.environ[${JSON.stringify(k)}] = ${JSON.stringify(v)}`)
    .join('\n');

  const pythonScript = `
import json, sys, traceback, os
from datetime import datetime, timezone

${envLines}
os.environ['AWS_REGION'] = 'ap-south-1'
os.environ['AWS_LAMBDA_FUNCTION_NAME'] = ${JSON.stringify(functionName)}

_log_buffer = []
_original_print = print

def print(*args, **kwargs):
    if kwargs.get('file') is sys.stderr:
        _original_print(*args, **kwargs)
        return
    msg = ' '.join(str(a) for a in args)
    ts = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    _log_buffer.append(ts + '\\tINFO\\t' + msg)
    _original_print(*args, **kwargs)

${code}

_event = json.loads(${JSON.stringify(JSON.stringify(event))})
_context = type('Context', (), {
    'function_name': ${JSON.stringify(functionName)},
    'function_version': '$LATEST',
    'aws_request_id': ${JSON.stringify(requestId)},
    'memory_limit_in_mb': ${memorySize},
    'get_remaining_time_in_millis': lambda self: ${timeoutMs},
})()

try:
    _result = ${handlerFn}(_event, _context)
    _output = {'result': _result, 'logs': _log_buffer, 'error': None}
except Exception as e:
    _output = {'result': None, 'logs': _log_buffer, 'error': str(e) + '\\n' + traceback.format_exc()}

_original_print(json.dumps(_output), file=sys.stderr)
`;

  let result;
  let errorObj;

  // spawnSync passes the script as a direct argument — no shell quoting issues on Windows
  const proc = spawnSync(PYTHON_CMD, ['-c', pythonScript], {
    timeout: timeoutMs + 2000,
    encoding: 'utf8',
    env: { ...process.env, ...envVars },
    maxBuffer: 10 * 1024 * 1024,
  });

  if (proc.error) {
    errorObj = proc.error.code === 'ETIMEDOUT'
      ? new Error(`Task timed out after ${timeoutMs / 1000}.00 seconds`)
      : new Error(proc.error.message);
  } else {
    const stderrText = proc.stderr || '';
    const jsonLine = stderrText.split('\n')
      .filter(l => { try { JSON.parse(l); return true; } catch { return false; } })
      .pop();

    if (jsonLine) {
      const parsed = JSON.parse(jsonLine);
      if (parsed.logs) logs.push(...parsed.logs);
      if (parsed.error) errorObj = new Error(parsed.error);
      else result = parsed.result;
    } else if (proc.status !== 0) {
      errorObj = new Error(stderrText || `Python exited with code ${proc.status}`);
    }
  }

  const duration = Date.now() - startTime;
  const billedDuration = Math.ceil(duration / 100) * 100;
  const memoryUsed = Math.floor(memorySize * 0.3 + Math.random() * memorySize * 0.1);

  return formatResult({ result, logs, duration, billedDuration, memoryUsed, requestId, functionName, error: errorObj });
}

/* ── Format result matching real AWS Lambda response ──────────────── */
function formatResult({ result, logs, duration, billedDuration, memoryUsed, requestId, functionName, error }) {
  const succeeded = !error;

  // Build CloudWatch-style log output
  const fullLogs = [
    `START RequestId: ${requestId} Version: $LATEST`,
    ...logs,
    `END RequestId: ${requestId}`,
    `REPORT RequestId: ${requestId}\tDuration: ${duration.toFixed(2)} ms\tBilled Duration: ${billedDuration} ms\tMemory Size: 128 MB\tMax Memory Used: ${memoryUsed} MB`,
  ];

  return {
    requestId,
    succeeded,
    result: succeeded ? result : null,
    errorMessage: error ? error.message : null,
    errorType: error ? (error.name || 'Error') : null,
    logs: fullLogs,
    duration: parseFloat(duration.toFixed(2)),
    billedDuration,
    memoryUsed,
  };
}

/* ── Safe require — allow only non-dangerous built-in modules ─────── */
const ALLOWED_MODULES = new Set([
  'crypto', 'util', 'path', 'os', 'url', 'querystring',
  'string_decoder', 'buffer', 'stream', 'events', 'assert',
]);

function safeRequire(mod) {
  if (ALLOWED_MODULES.has(mod)) return require(mod);
  // Allow relative requires to fail gracefully
  throw new Error(
    `Module "${mod}" is not available in this sandbox. ` +
    `Available built-ins: ${[...ALLOWED_MODULES].join(', ')}`
  );
}

module.exports = { executeLambda };
