import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, Play, Save, Plus, Trash2, ChevronDown } from 'lucide-react';
import { getFunction, updateFunction } from '../../lib/lambdaStore';

const RUNTIME_LABELS = {
  'nodejs20.x': 'Node.js 20.x',
  'nodejs18.x': 'Node.js 18.x',
  'python3.12': 'Python 3.12',
  'python3.11': 'Python 3.11',
};

const DEFAULT_EVENT = `{
  "key1": "value1",
  "key2": "value2",
  "key3": "value3"
}`;

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
      background: type === 'error' ? '#d13212' : '#1a7c1a',
      color: '#fff', padding: '12px 18px', borderRadius: 4,
      fontSize: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {message}
    </div>
  );
}

export default function FunctionDetail() {
  const { functionName } = useParams();
  const navigate = useNavigate();

  const [fn, setFn] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState('code');

  // Code tab
  const [code, setCode] = useState('');
  const [handler, setHandler] = useState('');
  const [codeDirty, setCodeDirty] = useState(false);
  const [deploying, setDeploying] = useState(false);

  // Test tab
  const [eventJson, setEventJson] = useState(DEFAULT_EVENT);
  const [eventError, setEventError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Configuration tab
  const [timeout, setTimeout_] = useState(3);
  const [memorySize, setMemorySize] = useState(128);
  const [envVars, setEnvVars] = useState([]);
  const [configDirty, setConfigDirty] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  function showToast(message, type = 'success') {
    setToast({ message, type });
  }

  async function loadFn() {
    try {
      const data = await getFunction(functionName);
      if (!data) { setNotFound(true); return; }
      setFn(data);
      setCode(data.code || '');
      setHandler(data.handler || '');
      setTimeout_(data.timeout || 3);
      setMemorySize(data.memorySize || 128);
      setEnvVars(Object.entries(data.envVars || {}).map(([k, v]) => ({ key: k, value: v })));
      setCodeDirty(false);
      setConfigDirty(false);
    } catch {
      setNotFound(true);
    }
  }

  useEffect(() => { loadFn(); }, [functionName]);

  /* ── Code tab: Deploy ──────────────────────────────────────────── */
  async function handleDeploy() {
    setDeploying(true);
    try {
      const updated = await updateFunction(functionName, { code, handler });
      setFn(updated);
      setCodeDirty(false);
      showToast('Changes deployed successfully.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDeploying(false);
    }
  }

  /* ── Test tab: Invoke via Floci (real Lambda runtime) ─────────────── */
  async function handleTest() {
    setEventError('');
    let parsedEvent;
    try {
      parsedEvent = JSON.parse(eventJson);
    } catch {
      setEventError('Invalid JSON — please fix the event before testing.');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const resp = await fetch(`/backend-api/lambda/invoke/${fn.functionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,           // current editor content (auto-deployed to Floci before invoke)
          event: parsedEvent,
        }),
      });
      const result = await resp.json();
      if (result.error) {
        setTestResult({ succeeded: false, errorMessage: result.error, logs: [], duration: 0, billedDuration: 0, memoryUsed: 0 });
      } else {
        setTestResult(result);
      }
    } catch (err) {
      setTestResult({ succeeded: false, errorMessage: err.message, logs: [], duration: 0, billedDuration: 0, memoryUsed: 0 });
    } finally {
      setTesting(false);
    }
  }

  /* ── Configuration tab: Save ───────────────────────────────────── */
  async function handleSaveConfig() {
    const envObj = {};
    for (const { key, value } of envVars) {
      if (key.trim()) envObj[key.trim()] = value;
    }
    try {
      const updated = await updateFunction(functionName, { timeout, memorySize, envVars: envObj });
      setFn(updated);
      setConfigDirty(false);
      showToast('Configuration saved.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function addEnvVar() {
    setEnvVars(prev => [...prev, { key: '', value: '' }]);
    setConfigDirty(true);
  }

  function removeEnvVar(i) {
    setEnvVars(prev => prev.filter((_, idx) => idx !== i));
    setConfigDirty(true);
  }

  function updateEnvVar(i, field, val) {
    setEnvVars(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
    setConfigDirty(true);
  }

  /* ── ARN ──────────────────────────────────────────────────────── */
  const arn = `arn:aws:lambda:ap-south-1:000000000000:function:${functionName}`;

  function copyArn() {
    navigator.clipboard.writeText(arn).then(() => showToast('ARN copied to clipboard.'));
  }

  /* ── Render ───────────────────────────────────────────────────── */
  if (notFound) {
    return (
      <div style={{ padding: 40, fontFamily: 'Arial, sans-serif', color: '#16191f' }}>
        <h2>Function not found</h2>
        <p>The function <strong>{functionName}</strong> does not exist.</p>
        <button onClick={() => navigate('/lambda')} style={{ color: '#0073bb', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
          ← Back to Functions
        </button>
      </div>
    );
  }

  if (!fn) return <div style={{ padding: 40 }}>Loading…</div>;

  const tabs = ['code', 'test', 'configuration', 'monitor'];

  return (
    <div style={{ background: '#f2f3f3', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #d5dbdb', padding: '16px 24px' }}>
        <div style={{ fontSize: 12, color: '#545b64', marginBottom: 4 }}>
          <span onClick={() => navigate('/lambda')} style={{ color: '#0073bb', cursor: 'pointer' }}>Lambda</span>
          {' > '}
          <span onClick={() => navigate('/lambda')} style={{ color: '#0073bb', cursor: 'pointer' }}>Functions</span>
          {' > '}{functionName}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 500, color: '#16191f' }}>{functionName}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#545b64', fontFamily: 'monospace' }}>{arn}</span>
              <button onClick={copyArn} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0073bb', padding: 2 }} title="Copy ARN">
                <Copy size={13} />
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              background: '#f0f4f8', border: '1px solid #d5dbdb', borderRadius: 4,
              padding: '4px 10px', fontSize: 13, color: '#545b64',
            }}>
              {RUNTIME_LABELS[fn.runtime] || fn.runtime}
            </span>
            {activeTab === 'code' && (
              <button
                onClick={handleDeploy}
                disabled={!codeDirty || deploying}
                style={{
                  padding: '8px 16px', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 500,
                  background: codeDirty && !deploying ? '#ec7211' : '#f5c6a8',
                  color: '#fff', cursor: codeDirty && !deploying ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Save size={13} /> {deploying ? 'Deploying…' : 'Deploy'}
              </button>
            )}
            {activeTab === 'test' && (
              <button
                onClick={handleTest}
                disabled={testing}
                style={{
                  padding: '8px 16px', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 500,
                  background: testing ? '#aab7b8' : '#0073bb', color: '#fff',
                  cursor: testing ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Play size={13} /> {testing ? 'Running…' : 'Test'}
              </button>
            )}
            {activeTab === 'configuration' && (
              <button
                onClick={handleSaveConfig}
                disabled={!configDirty}
                style={{
                  padding: '8px 16px', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 500,
                  background: configDirty ? '#0073bb' : '#aab7b8', color: '#fff',
                  cursor: configDirty ? 'pointer' : 'default',
                }}
              >
                Save
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #d5dbdb', paddingLeft: 24, display: 'flex' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? '#ec7211' : '#545b64',
              borderBottom: activeTab === tab ? '2px solid #ec7211' : '2px solid transparent',
              textTransform: 'capitalize', marginBottom: -1,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ padding: 24 }}>
        {/* ── CODE TAB ──────────────────────────────────────────────── */}
        {activeTab === 'code' && (
          <div>
            {/* Handler */}
            <div style={{ background: '#fff', border: '1px solid #d5dbdb', borderRadius: 4, marginBottom: 16, padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: '#16191f', whiteSpace: 'nowrap' }}>
                  Handler
                </label>
                <input
                  value={handler}
                  onChange={e => { setHandler(e.target.value); setCodeDirty(true); }}
                  style={{
                    padding: '6px 10px', fontSize: 14, border: '1px solid #aab7b8',
                    borderRadius: 4, outline: 'none', width: 240,
                  }}
                />
                <span style={{ fontSize: 12, color: '#545b64' }}>
                  {fn.runtime.startsWith('python') ? 'Format: filename.function_name' : 'Format: filename.exportName'}
                </span>
              </div>
            </div>

            {/* Code editor */}
            <div style={{ background: '#fff', border: '1px solid #d5dbdb', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                background: '#1e1e1e', padding: '8px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ color: '#cccccc', fontSize: 13, fontFamily: 'monospace' }}>
                  {fn.runtime.startsWith('python') ? 'lambda_function.py' : 'index.js'}
                </span>
                <span style={{ color: '#808080', fontSize: 12 }}>
                  {codeDirty ? '● unsaved changes' : 'saved'}
                </span>
              </div>
              <textarea
                value={code}
                onChange={e => { setCode(e.target.value); setCodeDirty(true); }}
                spellCheck={false}
                style={{
                  width: '100%', minHeight: 420, background: '#1e1e1e', color: '#d4d4d4',
                  fontFamily: '"Courier New", Courier, monospace', fontSize: 14,
                  lineHeight: 1.6, padding: '16px', border: 'none', outline: 'none',
                  resize: 'vertical', boxSizing: 'border-box', tabSize: 2,
                }}
                onKeyDown={e => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = e.target.selectionStart;
                    const end = e.target.selectionEnd;
                    const spaces = '  ';
                    const newVal = code.substring(0, start) + spaces + code.substring(end);
                    setCode(newVal);
                    setCodeDirty(true);
                    requestAnimationFrame(() => {
                      e.target.selectionStart = e.target.selectionEnd = start + spaces.length;
                    });
                  }
                }}
              />
            </div>

            <div style={{ marginTop: 8, fontSize: 12, color: '#687078' }}>
              Tab inserts 2 spaces. Click <strong>Deploy</strong> to save and activate your changes.
            </div>
          </div>
        )}

        {/* ── TEST TAB ──────────────────────────────────────────────── */}
        {activeTab === 'test' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            {/* Event editor */}
            <div style={{ background: '#fff', border: '1px solid #d5dbdb', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #eaeded', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#16191f' }}>Event JSON</span>
                <button
                  onClick={handleTest}
                  disabled={testing}
                  style={{
                    padding: '6px 14px', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 500,
                    background: testing ? '#aab7b8' : '#0073bb', color: '#fff',
                    cursor: testing ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <Play size={12} /> {testing ? 'Running…' : 'Test'}
                </button>
              </div>
              <textarea
                value={eventJson}
                onChange={e => { setEventJson(e.target.value); setEventError(''); }}
                spellCheck={false}
                style={{
                  width: '100%', height: 300, background: '#1e1e1e', color: '#d4d4d4',
                  fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6,
                  padding: '14px', border: 'none', outline: 'none',
                  resize: 'vertical', boxSizing: 'border-box',
                }}
              />
              {eventError && (
                <div style={{ padding: '8px 14px', background: '#fdf3f1', color: '#d13212', fontSize: 13 }}>
                  {eventError}
                </div>
              )}
              <div style={{ padding: '8px 14px', fontSize: 12, color: '#687078' }}>
                This event is passed as the first argument to your handler function.
              </div>
            </div>

            {/* Results */}
            <div style={{ background: '#fff', border: '1px solid #d5dbdb', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #eaeded' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#16191f' }}>Execution result</span>
              </div>

              {!testResult && !testing && (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#687078', fontSize: 14 }}>
                  Click <strong>Test</strong> to invoke your function and see the result here.
                </div>
              )}

              {testing && (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#687078', fontSize: 14 }}>
                  Invoking function…
                </div>
              )}

              {testResult && !testing && (
                <div>
                  {/* Status banner */}
                  <div style={{
                    padding: '10px 16px',
                    background: testResult.succeeded ? '#eaf9ea' : '#fdf3f1',
                    borderBottom: '1px solid ' + (testResult.succeeded ? '#b8e8b8' : '#f5a089'),
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: testResult.succeeded ? '#1a7c1a' : '#d13212',
                    }}>
                      {testResult.succeeded ? '✓ Succeeded' : '✗ Failed'}
                    </span>
                    <span style={{ fontSize: 12, color: '#545b64' }}>
                      Duration: {testResult.duration} ms · Billed: {testResult.billedDuration} ms · Memory: {testResult.memoryUsed} MB
                    </span>
                  </div>

                  {/* Return value */}
                  {testResult.succeeded && (
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #eaeded' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#16191f', marginBottom: 6 }}>Response</div>
                      <pre style={{
                        margin: 0, padding: '10px', background: '#f8f8f8', borderRadius: 4,
                        fontFamily: 'monospace', fontSize: 12, overflowX: 'auto', color: '#16191f',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {JSON.stringify(testResult.result, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Error */}
                  {!testResult.succeeded && testResult.errorMessage && (
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #eaeded' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#d13212', marginBottom: 6 }}>
                        {testResult.errorType || 'Error'}
                      </div>
                      <pre style={{
                        margin: 0, padding: '10px', background: '#fdf3f1', borderRadius: 4,
                        fontFamily: 'monospace', fontSize: 12, color: '#d13212',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {testResult.errorMessage}
                      </pre>
                    </div>
                  )}

                  {/* Logs */}
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#16191f' }}>Log output</div>
                      <a
                        href={`/cloudwatch/logs/streams?group=${encodeURIComponent('/aws/lambda/' + fn.functionName)}`}
                        style={{ fontSize: 11, color: 'var(--aws-blue)' }}
                      >
                        View in CloudWatch →
                      </a>
                    </div>
                    <div style={{
                      background: '#0d1117', borderRadius: 4, padding: '10px 12px',
                      maxHeight: 240, overflowY: 'auto',
                    }}>
                      {(testResult.logs || []).map((line, i) => (
                        <div key={i} style={{
                          fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7,
                          color: line.includes('ERROR') ? '#ff6b6b' : line.includes('WARN') ? '#ffd700' : '#c9d1d9',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                        }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CONFIGURATION TAB ─────────────────────────────────────── */}
        {activeTab === 'configuration' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* General */}
            <div style={{ background: '#fff', border: '1px solid #d5dbdb', borderRadius: 4 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #eaeded' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#16191f' }}>General configuration</span>
              </div>
              <div style={{ padding: '20px', display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#16191f', marginBottom: 6 }}>
                    Timeout (seconds)
                  </label>
                  <input
                    type="number"
                    min={1} max={900}
                    value={timeout}
                    onChange={e => { setTimeout_(Number(e.target.value)); setConfigDirty(true); }}
                    style={{
                      padding: '7px 12px', fontSize: 14, border: '1px solid #aab7b8',
                      borderRadius: 4, outline: 'none', width: 100,
                    }}
                  />
                  <div style={{ fontSize: 11, color: '#687078', marginTop: 4 }}>1 – 900 seconds</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#16191f', marginBottom: 6 }}>
                    Memory (MB)
                  </label>
                  <select
                    value={memorySize}
                    onChange={e => { setMemorySize(Number(e.target.value)); setConfigDirty(true); }}
                    style={{
                      padding: '7px 12px', fontSize: 14, border: '1px solid #aab7b8',
                      borderRadius: 4, outline: 'none', background: '#fff', cursor: 'pointer', width: 130,
                    }}
                  >
                    {[128, 256, 512, 1024, 2048, 3008].map(m => (
                      <option key={m} value={m}>{m} MB</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: '#687078', marginTop: 4 }}>128 – 3,008 MB</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#16191f', marginBottom: 6 }}>
                    Runtime
                  </label>
                  <span style={{ fontSize: 14, color: '#16191f' }}>{RUNTIME_LABELS[fn.runtime] || fn.runtime}</span>
                </div>
              </div>
            </div>

            {/* Environment variables */}
            <div style={{ background: '#fff', border: '1px solid #d5dbdb', borderRadius: 4 }}>
              <div style={{
                padding: '14px 20px', borderBottom: '1px solid #eaeded',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#16191f' }}>Environment variables</span>
                <button
                  onClick={addEnvVar}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: '#fff', border: '1px solid #0073bb', color: '#0073bb',
                    borderRadius: 4, padding: '6px 12px', fontSize: 13, cursor: 'pointer',
                  }}
                >
                  <Plus size={13} /> Add variable
                </button>
              </div>
              <div style={{ padding: '16px 20px' }}>
                {envVars.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 14, color: '#687078' }}>
                    No environment variables set. Click <strong>Add variable</strong> to add one.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#545b64' }}>Key</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#545b64' }}>Value</span>
                    </div>
                    {envVars.map((ev, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 8, alignItems: 'center' }}>
                        <input
                          value={ev.key}
                          onChange={e => updateEnvVar(i, 'key', e.target.value)}
                          placeholder="KEY"
                          style={{
                            padding: '7px 10px', fontSize: 13, border: '1px solid #aab7b8',
                            borderRadius: 4, outline: 'none', fontFamily: 'monospace',
                          }}
                        />
                        <input
                          value={ev.value}
                          onChange={e => updateEnvVar(i, 'value', e.target.value)}
                          placeholder="value"
                          style={{
                            padding: '7px 10px', fontSize: 13, border: '1px solid #aab7b8',
                            borderRadius: 4, outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => removeEnvVar(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d13212', padding: 4 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── MONITOR TAB ───────────────────────────────────────────── */}
        {activeTab === 'monitor' && (
          <div style={{ background: '#fff', border: '1px solid #d5dbdb', borderRadius: 4, padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#16191f' }}>CloudWatch Metrics</h3>
            <p style={{ fontSize: 14, color: '#687078', maxWidth: 400, margin: '0 auto' }}>
              Invocations, errors, duration, and throttles are tracked per execution.
              Full CloudWatch integration coming soon.
            </p>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
