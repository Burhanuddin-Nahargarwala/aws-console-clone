import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createFunction } from '../../lib/lambdaStore';
import { useRegion } from '../../lib/RegionContext';

const RUNTIMES = [
  { value: 'nodejs20.x', label: 'Node.js 20.x' },
  { value: 'nodejs18.x', label: 'Node.js 18.x' },
  { value: 'python3.12', label: 'Python 3.12' },
  { value: 'python3.11', label: 'Python 3.11' },
];

const DEFAULT_CODE = {
  'nodejs20.x': `exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));

  const response = {
    statusCode: 200,
    body: JSON.stringify('Hello from Lambda!'),
  };
  return response;
};`,
  'nodejs18.x': `exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));

  const response = {
    statusCode: 200,
    body: JSON.stringify('Hello from Lambda!'),
  };
  return response;
};`,
  'python3.12': `import json

def lambda_handler(event, context):
    print(f"Event: {json.dumps(event)}")

    return {
        'statusCode': 200,
        'body': json.dumps('Hello from Lambda!')
    }`,
  'python3.11': `import json

def lambda_handler(event, context):
    print(f"Event: {json.dumps(event)}")

    return {
        'statusCode': 200,
        'body': json.dumps('Hello from Lambda!')
    }`,
};

const DEFAULT_HANDLER = {
  'nodejs20.x': 'index.handler',
  'nodejs18.x': 'index.handler',
  'python3.12': 'lambda_function.lambda_handler',
  'python3.11': 'lambda_function.lambda_handler',
};

export default function CreateFunction() {
  const navigate = useNavigate();
  const { region } = useRegion();
  const [functionName, setFunctionName] = useState('');
  const [runtime, setRuntime] = useState('nodejs20.x');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!/^[a-zA-Z0-9-_]{1,64}$/.test(functionName)) {
      setError('Function name must be 1–64 characters: letters, numbers, hyphens, underscores only.');
      return;
    }
    setCreating(true);
    try {
      await createFunction({
        functionName,
        runtime,
        handler: DEFAULT_HANDLER[runtime],
        description,
        timeout: 3,
        memorySize: 128,
        envVars: {},
        code: DEFAULT_CODE[runtime],
        region,
      });
      navigate(`/lambda/function/${functionName}`);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  const labelStyle = { display: 'block', fontWeight: 600, fontSize: 14, color: '#16191f', marginBottom: 6 };
  const inputStyle = {
    width: '100%', maxWidth: 400, padding: '8px 12px', fontSize: 14,
    border: '1px solid #aab7b8', borderRadius: 4, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ background: '#f2f3f3', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #d5dbdb', padding: '16px 24px' }}>
        <div style={{ fontSize: 12, color: '#545b64', marginBottom: 4 }}>
          <span onClick={() => navigate('/lambda')} style={{ color: '#0073bb', cursor: 'pointer' }}>Lambda</span>
          {' > '}
          <span onClick={() => navigate('/lambda')} style={{ color: '#0073bb', cursor: 'pointer' }}>Functions</span>
          {' > '}Create function
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: '#16191f' }}>Create function</h1>
      </div>

      <div style={{ padding: '24px', maxWidth: 900 }}>
        {/* Card */}
        <div style={{ background: '#fff', border: '1px solid #d5dbdb', borderRadius: 4, marginBottom: 20 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #eaeded' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#16191f' }}>Create function</h2>
          </div>
          <div style={{ padding: '20px' }}>
            {/* Method option */}
            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px',
                border: '2px solid #0073bb', borderRadius: 4, background: '#f0f8ff',
                cursor: 'pointer', maxWidth: 400,
              }}>
                <input type="radio" defaultChecked style={{ marginTop: 3 }} readOnly />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#16191f' }}>Author from scratch</div>
                  <div style={{ fontSize: 13, color: '#545b64', marginTop: 2 }}>
                    Start with a simple Hello World example.
                  </div>
                </div>
              </label>
            </div>

            {/* Function name */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>
                Function name <span style={{ color: '#d13212' }}>*</span>
              </label>
              <input
                value={functionName}
                onChange={e => { setFunctionName(e.target.value); setError(''); }}
                placeholder="my-function"
                style={inputStyle}
              />
              <div style={{ fontSize: 12, color: '#545b64', marginTop: 4 }}>
                Only letters, numbers, hyphens, and underscores. No spaces.
              </div>
            </div>

            {/* Runtime */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>
                Runtime <span style={{ color: '#d13212' }}>*</span>
              </label>
              <select
                value={runtime}
                onChange={e => setRuntime(e.target.value)}
                style={{ ...inputStyle, maxWidth: 220, cursor: 'pointer', background: '#fff' }}
              >
                {RUNTIMES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Architecture */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Architecture</label>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                border: '2px solid #0073bb', borderRadius: 4, background: '#f0f8ff', cursor: 'pointer',
              }}>
                <input type="radio" defaultChecked readOnly /> x86_64
              </label>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Description</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional description"
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{
                padding: '10px 14px', background: '#fdf3f1', border: '1px solid #f5a089',
                borderRadius: 4, color: '#d13212', fontSize: 14, marginBottom: 8,
              }}>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => navigate('/lambda')}
            style={{ padding: '8px 20px', border: '1px solid #aab7b8', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 14 }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!functionName || creating}
            style={{
              padding: '8px 20px', border: 'none', borderRadius: 4,
              background: functionName && !creating ? '#ec7211' : '#f5c6a8',
              color: '#fff', cursor: functionName && !creating ? 'pointer' : 'default',
              fontSize: 14, fontWeight: 500,
            }}
          >
            {creating ? 'Creating…' : 'Create function'}
          </button>
        </div>
      </div>
    </div>
  );
}
