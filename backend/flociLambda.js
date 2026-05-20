const zlib = require('zlib');
const { spawnSync } = require('child_process');

/**
 * Floci Lambda API helper
 *
 * Registers / updates Lambda functions in Floci (localhost:4566) so that
 * AWS CLI and boto3 commands can see and invoke them directly.
 *
 * ZIP creation uses only Node.js built-ins — no npm dependencies.
 */

const FLOCI_ENDPOINT = 'http://localhost:4566';

/* ── Minimal ZIP builder (no dependencies) ─────────────────────────
 * Creates a valid ZIP archive containing a single file with STORE
 * (no compression). Floci only needs a syntactically valid ZIP.
 */
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (crc >>> 1) ^ 0xEDB88320 : (crc >>> 1);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createZipBuffer(filename, content) {
  const fileData   = Buffer.from(content, 'utf8');
  const nameBuffer = Buffer.from(filename, 'utf8');
  const crc        = crc32(fileData);
  const fileLen    = fileData.length;
  const nameLen    = nameBuffer.length;

  // Local file header (30 bytes + filename)
  const local = Buffer.alloc(30 + nameLen);
  local.writeUInt32LE(0x04034b50, 0);   // signature
  local.writeUInt16LE(20,          4);   // version needed
  local.writeUInt16LE(0,           6);   // flags
  local.writeUInt16LE(0,           8);   // compression: STORE
  local.writeUInt16LE(0,          10);   // mod time
  local.writeUInt16LE(0,          12);   // mod date
  local.writeUInt32LE(crc,        14);   // CRC-32
  local.writeUInt32LE(fileLen,    18);   // compressed size
  local.writeUInt32LE(fileLen,    22);   // uncompressed size
  local.writeUInt16LE(nameLen,    26);   // filename length
  local.writeUInt16LE(0,          28);   // extra field length
  nameBuffer.copy(local, 30);

  // Central directory header (46 bytes + filename)
  const centralOffset = local.length + fileLen;
  const central = Buffer.alloc(46 + nameLen);
  central.writeUInt32LE(0x02014b50,  0);
  central.writeUInt16LE(20,          4);
  central.writeUInt16LE(20,          6);
  central.writeUInt16LE(0,           8);
  central.writeUInt16LE(0,          10);
  central.writeUInt16LE(0,          12);
  central.writeUInt16LE(0,          14);
  central.writeUInt32LE(crc,        16);
  central.writeUInt32LE(fileLen,    20);
  central.writeUInt32LE(fileLen,    24);
  central.writeUInt16LE(nameLen,    28);
  central.writeUInt16LE(0,          30);
  central.writeUInt16LE(0,          32);
  central.writeUInt16LE(0,          34);
  central.writeUInt16LE(0,          36);
  central.writeUInt32LE(0,          38);
  central.writeUInt32LE(0,          42);  // local header offset
  nameBuffer.copy(central, 46);

  // End of central directory (22 bytes)
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,          0);
  end.writeUInt16LE(0,                   4);
  end.writeUInt16LE(0,                   6);
  end.writeUInt16LE(1,                   8);
  end.writeUInt16LE(1,                  10);
  end.writeUInt32LE(central.length,     12);
  end.writeUInt32LE(centralOffset,      16);
  end.writeUInt16LE(0,                  20);

  return Buffer.concat([local, fileData, central, end]);
}

/* ── Determine source filename from runtime ────────────────────────── */
function sourceFilename(runtime) {
  if (runtime.startsWith('python')) return 'lambda_function.py';
  return 'index.js';
}

/* ── Floci HTTP helpers ────────────────────────────────────────────── */
function fakeAuth(region) {
  return `AWS4-HMAC-SHA256 Credential=test/20260101/${region}/lambda/aws4_request, SignedHeaders=host, Signature=test`;
}

async function flociRequest(method, path, body, isOctet = false, region = 'ap-south-1') {
  const headers = {
    'Authorization': fakeAuth(region),
    'X-Amz-Date': new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z',
  };

  if (isOctet) {
    headers['Content-Type'] = 'application/octet-stream';
  } else {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${FLOCI_ENDPOINT}${path}`, {
    method,
    headers,
    body: isOctet ? body : (body !== undefined ? JSON.stringify(body) : undefined),
  });

  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* plain text response */ }

  if (!res.ok) {
    throw new Error(data.message || data.Message || data.__type || `Floci Lambda ${method} ${path} → ${res.status}`);
  }
  return data;
}

/* ── Public API ────────────────────────────────────────────────────── */

async function registerInFloci({ functionName, runtime, handler, code, description, timeout, memorySize, envVars, region = 'ap-south-1' }) {
  const filename = sourceFilename(runtime);
  const zipBuffer = createZipBuffer(filename, code);
  const zipBase64 = zipBuffer.toString('base64');

  try {
    await flociRequest('POST', '/2015-03-31/functions/', {
      FunctionName: functionName,
      Runtime: runtime,
      Handler: handler,
      Role: 'arn:aws:iam::000000000000:role/lambda-role',
      Description: description || '',
      Timeout: timeout || 3,
      MemorySize: memorySize || 128,
      Environment: { Variables: envVars || {} },
      Code: { ZipFile: zipBase64 },
    }, false, region);
  } catch (err) {
    if (err.message.includes('already exist') || err.message.includes('ResourceConflictException') || err.message.includes('409')) {
      await updateCodeInFloci(functionName, code, runtime, { handler, timeout, memorySize, envVars, description }, region);
    } else {
      throw err;
    }
  }
}

async function updateCodeInFloci(functionName, code, runtime, config = {}, region = 'ap-south-1') {
  const filename = sourceFilename(runtime);
  const zipBuffer = createZipBuffer(filename, code);
  const zipBase64 = zipBuffer.toString('base64');

  await flociRequest('PUT', `/2015-03-31/functions/${functionName}/code`, { ZipFile: zipBase64 }, false, region);

  if (Object.keys(config).length > 0) {
    const body = {};
    if (config.handler)     body.Handler     = config.handler;
    if (config.timeout)     body.Timeout     = config.timeout;
    if (config.memorySize)  body.MemorySize  = config.memorySize;
    if (config.description !== undefined) body.Description = config.description;
    if (config.envVars)     body.Environment = { Variables: config.envVars };
    if (Object.keys(body).length > 0) {
      await flociRequest('PUT', `/2015-03-31/functions/${functionName}/configuration`, body, false, region);
    }
  }
}

async function deleteFromFloci(functionName, region = 'ap-south-1') {
  try {
    await flociRequest('DELETE', `/2015-03-31/functions/${functionName}`, undefined, false, region);
  } catch (err) {
    if (!err.message.includes('404') && !err.message.includes('ResourceNotFoundException')) throw err;
  }
}

async function listFromFloci(region = 'ap-south-1') {
  const data = await flociRequest('GET', '/2015-03-31/functions/', undefined, false, region);
  return data.Functions || [];
}

async function getFunctionFromFloci(functionName, region = 'ap-south-1') {
  return flociRequest('GET', `/2015-03-31/functions/${functionName}`, undefined, false, region);
}

// Parse a ZIP and extract a named file — supports STORE (0) and DEFLATE (8)
function extractFileFromZip(buffer, filename) {
  let offset = 0;
  while (offset < buffer.length - 30) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break; // local file header sig
    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize    = buffer.readUInt32LE(offset + 18);
    const filenameLength    = buffer.readUInt16LE(offset + 26);
    const extraLength       = buffer.readUInt16LE(offset + 28);
    const entryName         = buffer.slice(offset + 30, offset + 30 + filenameLength).toString('utf8');
    const dataStart         = offset + 30 + filenameLength + extraLength;

    if (entryName === filename) {
      const compressed = buffer.slice(dataStart, dataStart + compressedSize);
      if (compressionMethod === 0) return compressed.toString('utf8');          // STORE
      if (compressionMethod === 8) return zlib.inflateRawSync(compressed).toString('utf8'); // DEFLATE
      return null; // unsupported compression
    }
    offset = dataStart + compressedSize;
  }
  return null;
}

// Floci returns an AWS-style S3 URL for Code.Location (e.g. https://bucket.s3.region.amazonaws.com/key)
// Convert it to a local path-style URL (http://localhost:4566/bucket/key)
function toLocalFlociUrl(awsUrl) {
  try {
    const url = new URL(awsUrl);
    if (!url.hostname.includes('amazonaws.com')) return awsUrl; // already local
    const bucket = url.hostname.split('.')[0]; // e.g. awslambda-ap-south-1-tasks
    const key    = url.pathname.slice(1);      // strip leading /
    return `${FLOCI_ENDPOINT}/${bucket}/${key}`;
  } catch {
    return awsUrl;
  }
}

// Read code directly from Floci container filesystem via docker exec
// Floci stores extracted code at /app/data/lambda-code/{functionName}/{filename}
function getCodeViaDockerExec(functionName, runtime) {
  try {
    const filename = runtime.startsWith('python') ? 'lambda_function.py' : 'index.js';

    // Find the running Floci container
    const ps = spawnSync('docker', ['ps', '--format', '{{.Names}}', '--filter', 'name=floci'], { encoding: 'utf8' });
    const containerName = (ps.stdout || '').trim().split('\n').find(n => n.includes('floci'));
    if (!containerName) {
      console.log('[getCode] No Floci container found via docker ps');
      return null;
    }
    console.log(`[getCode] Using container: ${containerName}`);

    // Try the known code path first
    const knownPath = `/app/data/lambda-code/${functionName}/${filename}`;
    const cat = spawnSync('docker', ['exec', containerName, 'cat', knownPath], { encoding: 'utf8' });
    if (cat.status === 0 && cat.stdout) {
      console.log(`[getCode] Read ${cat.stdout.length} chars from ${knownPath}`);
      return cat.stdout;
    }

    // Path not found — list directory to find the actual structure
    const ls = spawnSync('docker', ['exec', containerName, 'find', `/app/data/lambda-code/${functionName}`, '-type', 'f'], { encoding: 'utf8' });
    console.log(`[getCode] Files in lambda-code/${functionName}:`, ls.stdout || ls.stderr);
    return null;
  } catch (err) {
    console.log(`[getCode] docker exec error: ${err.message}`);
    return null;
  }
}

// Fetch the deployed code from Floci — tries docker exec first, then S3 ZIP download
async function getCodeFromFloci(functionName, runtime, region = 'ap-south-1') {
  // Strategy 1: docker exec (most reliable — reads directly from container filesystem)
  const dockerCode = getCodeViaDockerExec(functionName, runtime);
  if (dockerCode) return dockerCode;

  // Strategy 2: download ZIP from Floci's S3 storage
  try {
    const data = await flociRequest('GET', `/2015-03-31/functions/${functionName}`, undefined, false, region);
    const awsUrl = data?.Code?.Location;
    if (!awsUrl) return null;

    const localUrl = toLocalFlociUrl(awsUrl);
    console.log(`[getCode] Trying S3 download: ${localUrl}`);

    const s3Auth = `AWS4-HMAC-SHA256 Credential=test/20260101/${region}/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=test`;
    const zipRes = await fetch(localUrl, {
      headers: {
        'Authorization': s3Auth,
        'X-Amz-Date': new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z',
      },
    });
    if (!zipRes.ok) {
      console.log(`[getCode] S3 download failed: ${zipRes.status}`);
      return null;
    }

    const zipBuffer = Buffer.from(await zipRes.arrayBuffer());
    const filename  = runtime.startsWith('python') ? 'lambda_function.py' : 'index.js';
    const extracted = extractFileFromZip(zipBuffer, filename);
    console.log(`[getCode] S3 extracted "${filename}": ${extracted === null ? 'NOT FOUND' : `${extracted.length} chars`}`);
    return extracted;
  } catch (err) {
    console.log(`[getCode] S3 error: ${err.message}`);
    return null;
  }
}

async function invokeInFloci(functionName, event, region = 'ap-south-1') {
  const headers = {
    'Authorization': fakeAuth(region),
    'X-Amz-Date': new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z',
    'Content-Type': 'application/json',
    'X-Amz-Log-Type': 'Tail',  // makes Floci return logs in response header
  };

  const res = await fetch(`${FLOCI_ENDPOINT}/2015-03-31/functions/${functionName}/invocations`, {
    method: 'POST',
    headers,
    body: JSON.stringify(event),
  });

  const bodyText = await res.text();
  let result;
  try { result = JSON.parse(bodyText); } catch { result = bodyText; }

  // Floci returns logs as base64 in this header
  const logResultB64 = res.headers.get('x-amz-log-result') || '';
  const logs = logResultB64 ? Buffer.from(logResultB64, 'base64').toString('utf8') : '';
  const functionError = res.headers.get('x-amz-function-error') || null;

  return { result, logs, functionError };
}

module.exports = { registerInFloci, updateCodeInFloci, deleteFromFloci, listFromFloci, getFunctionFromFloci, invokeInFloci, getCodeFromFloci };
