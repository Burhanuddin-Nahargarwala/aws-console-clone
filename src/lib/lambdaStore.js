// Lambda function store — backed by our Node.js backend, which also
// registers functions in Floci so AWS CLI and boto3 can see them.

const BASE = '/backend-api/lambda/functions';

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function listFunctions(region)    { return request('GET', region ? `?region=${encodeURIComponent(region)}` : ''); }
export function getFunction(name)        { return request('GET',    `/${name}`); }
export function createFunction(fn)       { return request('POST',   '', fn); }
export function updateFunction(name, updates) { return request('PUT', `/${name}`, updates); }
export function deleteFunction(name)     { return request('DELETE', `/${name}`); }
