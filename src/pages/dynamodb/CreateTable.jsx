import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTable } from '../../lib/dynamoClient';

const TYPE_OPTIONS = [
  { value: 'S', label: 'String' },
  { value: 'N', label: 'Number' },
  { value: 'B', label: 'Binary' },
];

export default function CreateTable() {
  const navigate = useNavigate();
  const [tableName, setTableName] = useState('');
  const [pkName, setPkName] = useState('');
  const [pkType, setPkType] = useState('S');
  const [hasSortKey, setHasSortKey] = useState(false);
  const [skName, setSkName] = useState('');
  const [skType, setSkType] = useState('S');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!tableName.trim()) { setError('Table name is required.'); return; }
    if (!pkName.trim()) { setError('Partition key name is required.'); return; }
    if (hasSortKey && !skName.trim()) { setError('Sort key name is required when enabled.'); return; }
    if (hasSortKey && skName.trim() === pkName.trim()) { setError('Sort key must be different from partition key.'); return; }

    setCreating(true);
    setError('');
    try {
      await createTable({
        tableName: tableName.trim(),
        partitionKey: pkName.trim(),
        partitionKeyType: pkType,
        sortKey: hasSortKey ? skName.trim() : null,
        sortKeyType: hasSortKey ? skType : null,
      });
      navigate(`/dynamodb/table/${tableName.trim()}`);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  const labelStyle = { display: 'block', fontWeight: 600, fontSize: 14, color: '#16191f', marginBottom: 6 };
  const inputStyle = { padding: '8px 12px', fontSize: 14, border: '1px solid #aab7b8', borderRadius: 4, outline: 'none', width: 280, boxSizing: 'border-box' };
  const selectStyle = { padding: '8px 12px', fontSize: 14, border: '1px solid #aab7b8', borderRadius: 4, outline: 'none', background: '#fff', cursor: 'pointer', width: 130 };

  return (
    <div style={{ background: '#f2f3f3', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #d5dbdb', padding: '16px 24px' }}>
        <div style={{ fontSize: 12, color: '#545b64', marginBottom: 4 }}>
          <span onClick={() => navigate('/dynamodb')} style={{ color: '#0073bb', cursor: 'pointer' }}>DynamoDB</span>
          {' > '}
          <span onClick={() => navigate('/dynamodb')} style={{ color: '#0073bb', cursor: 'pointer' }}>Tables</span>
          {' > '}Create table
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: '#16191f' }}>Create table</h1>
      </div>

      <div style={{ padding: 24, maxWidth: 860 }}>
        {/* Table details */}
        <div style={{ background: '#fff', border: '1px solid #d5dbdb', borderRadius: 4, marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #eaeded' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#16191f' }}>Table details</h2>
          </div>
          <div style={{ padding: 20 }}>
            {/* Table name */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Table name <span style={{ color: '#d13212' }}>*</span></label>
              <input
                value={tableName}
                onChange={e => { setTableName(e.target.value); setError(''); }}
                placeholder="my-table"
                style={inputStyle}
              />
              <div style={{ fontSize: 12, color: '#545b64', marginTop: 4 }}>
                Between 3 and 255 characters. Letters, numbers, hyphens, underscores, and dots.
              </div>
            </div>

            {/* Partition key */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Partition key <span style={{ color: '#d13212' }}>*</span></label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  value={pkName}
                  onChange={e => { setPkName(e.target.value); setError(''); }}
                  placeholder="e.g. id"
                  style={inputStyle}
                />
                <select value={pkType} onChange={e => setPkType(e.target.value)} style={selectStyle}>
                  {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 12, color: '#545b64', marginTop: 4 }}>
                The partition key (HASH key) uniquely identifies each item in the table.
              </div>
            </div>

            {/* Sort key toggle */}
            <div style={{ marginBottom: hasSortKey ? 20 : 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={hasSortKey}
                  onChange={e => setHasSortKey(e.target.checked)}
                  style={{ width: 15, height: 15 }}
                />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#16191f' }}>Add sort key</span>
              </label>
              <div style={{ fontSize: 12, color: '#545b64', marginTop: 4, marginLeft: 23 }}>
                A sort key lets you have multiple items with the same partition key.
              </div>
            </div>

            {hasSortKey && (
              <div style={{ marginBottom: 0 }}>
                <label style={labelStyle}>Sort key <span style={{ color: '#d13212' }}>*</span></label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    value={skName}
                    onChange={e => { setSkName(e.target.value); setError(''); }}
                    placeholder="e.g. createdAt"
                    style={inputStyle}
                  />
                  <select value={skType} onChange={e => setSkType(e.target.value)} style={selectStyle}>
                    {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table settings */}
        <div style={{ background: '#fff', border: '1px solid #d5dbdb', borderRadius: 4, marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #eaeded' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#16191f' }}>Table settings</h2>
          </div>
          <div style={{ padding: 20 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input type="radio" defaultChecked style={{ marginTop: 3 }} readOnly />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#16191f' }}>Default settings</div>
                <div style={{ fontSize: 13, color: '#545b64', marginTop: 2 }}>
                  On-demand capacity · No secondary indexes · AES-256 encryption · Point-in-time recovery off
                </div>
              </div>
            </label>
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#fdf3f1', border: '1px solid #f5a089', borderRadius: 4, color: '#d13212', fontSize: 14, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => navigate('/dynamodb')}
            style={{ padding: '8px 20px', border: '1px solid #aab7b8', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 14 }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!tableName || !pkName || creating}
            style={{
              padding: '8px 20px', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 500,
              background: tableName && pkName && !creating ? '#ec7211' : '#f5c6a8',
              color: '#fff', cursor: tableName && pkName && !creating ? 'pointer' : 'default',
            }}
          >
            {creating ? 'Creating…' : 'Create table'}
          </button>
        </div>
      </div>
    </div>
  );
}
