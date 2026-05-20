import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RefreshCw, Plus, Trash2, Play, X } from 'lucide-react';
import {
  describeTable, scanWithFilters, queryTable,
  putItem, deleteItem, fromDynamoItem, parseItemJson,
} from '../../lib/dynamoClient';

/* ── Constants ─────────────────────────────────────────────────────── */
const STRING_CONDITIONS = [
  { value: '=',                    label: '=' },
  { value: '<>',                   label: '≠' },
  { value: 'begins_with',          label: 'Begins with' },
  { value: 'contains',             label: 'Contains' },
  { value: 'attribute_exists',     label: 'Attribute exists' },
  { value: 'attribute_not_exists', label: 'Attribute not exists' },
];
const NUMBER_CONDITIONS = [
  { value: '=',                    label: '=' },
  { value: '<>',                   label: '≠' },
  { value: '<',                    label: '<' },
  { value: '<=',                   label: '≤' },
  { value: '>',                    label: '>' },
  { value: '>=',                   label: '≥' },
  { value: 'between',              label: 'Between' },
  { value: 'attribute_exists',     label: 'Attribute exists' },
  { value: 'attribute_not_exists', label: 'Attribute not exists' },
];
const SK_CONDITIONS = [
  { value: '=',           label: '=' },
  { value: '<',           label: '<' },
  { value: '<=',          label: '≤' },
  { value: '>',           label: '>' },
  { value: '>=',          label: '≥' },
  { value: 'between',     label: 'Between' },
  { value: 'begins_with', label: 'Begins with' },
];
const TYPE_LABELS = { S: 'String', N: 'Number', B: 'Binary' };

/* ── Toast ─────────────────────────────────────────────────────────── */
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
      background: type === 'error' ? '#d13212' : '#1a7c1a',
      color: '#fff', padding: '12px 18px', borderRadius: 4, fontSize: 14,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    }}>{message}</div>
  );
}

/* ── Filter row ────────────────────────────────────────────────────── */
function FilterRow({ filter, onChange, onRemove }) {
  const conditions = filter.type === 'N' ? NUMBER_CONDITIONS : STRING_CONDITIONS;
  const noValue = ['attribute_exists', 'attribute_not_exists'].includes(filter.condition);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        value={filter.attribute}
        onChange={e => onChange({ ...filter, attribute: e.target.value })}
        placeholder="Attribute name"
        style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #aab7b8', borderRadius: 4, outline: 'none', width: 160 }}
      />
      <select
        value={filter.type}
        onChange={e => onChange({ ...filter, type: e.target.value, condition: '=', value: '', value2: '' })}
        style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #aab7b8', borderRadius: 4, outline: 'none', background: '#fff' }}
      >
        <option value="S">String</option>
        <option value="N">Number</option>
      </select>
      <select
        value={filter.condition}
        onChange={e => onChange({ ...filter, condition: e.target.value, value: '', value2: '' })}
        style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #aab7b8', borderRadius: 4, outline: 'none', background: '#fff' }}
      >
        {conditions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      {!noValue && (
        <input
          value={filter.value}
          onChange={e => onChange({ ...filter, value: e.target.value })}
          placeholder={filter.condition === 'between' ? 'From' : 'Value'}
          style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #aab7b8', borderRadius: 4, outline: 'none', width: 130 }}
        />
      )}
      {filter.condition === 'between' && (
        <input
          value={filter.value2}
          onChange={e => onChange({ ...filter, value2: e.target.value })}
          placeholder="To"
          style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #aab7b8', borderRadius: 4, outline: 'none', width: 130 }}
        />
      )}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d13212', padding: 4 }}>
        <X size={15} />
      </button>
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────── */
export default function TableDetail() {
  const { tableName } = useParams();
  const navigate = useNavigate();

  const [table, setTable]       = useState(null);
  const [activeTab, setActiveTab] = useState('items');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // Items tab
  const [mode, setMode]         = useState('scan');   // 'scan' | 'query'
  const [filters, setFilters]   = useState([]);
  const [pkValue, setPkValue]   = useState('');
  const [skCondition, setSkCondition] = useState('=');
  const [skValue, setSkValue]   = useState('');
  const [skValue2, setSkValue2] = useState('');

  const [items, setItems]       = useState([]);
  const [columns, setColumns]   = useState([]);
  const [running, setRunning]   = useState(false);
  const [hasRun, setHasRun]     = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm]     = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => setToast({ message: msg, type });

  /* ── Load table metadata ─────────────────────────────────────────── */
  async function loadTable() {
    setLoading(true); setError('');
    try { setTable(await describeTable(tableName)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadTable(); }, [tableName]);
  useEffect(() => { if (table) handleRun(); }, [table]);

  /* ── Key schema helpers ──────────────────────────────────────────── */
  function getKeyInfo() {
    if (!table) return { pk: null, sk: null };
    const ks = table.KeySchema || [];
    const attrs = Object.fromEntries((table.AttributeDefinitions || []).map(a => [a.AttributeName, a.AttributeType]));
    const pk = ks.find(k => k.KeyType === 'HASH');
    const sk = ks.find(k => k.KeyType === 'RANGE');
    return {
      pk: pk ? { name: pk.AttributeName, type: attrs[pk.AttributeName] || 'S' } : null,
      sk: sk ? { name: sk.AttributeName, type: attrs[sk.AttributeName] || 'S' } : null,
    };
  }

  /* ── Run scan / query ────────────────────────────────────────────── */
  async function handleRun() {
    setRunning(true); setSelectedRows(new Set());
    try {
      let data;
      if (mode === 'query') {
        const { pk, sk } = getKeyInfo();
        if (!pkValue.trim()) { showToast('Partition key value is required for Query.', 'error'); setRunning(false); return; }
        data = await queryTable(tableName, {
          pkName: pk.name, pkValue: pkValue.trim(), pkType: pk.type,
          skName: sk?.name, skType: sk?.type,
          skCondition, skValue, skValue2,
          filters,
        });
      } else {
        data = await scanWithFilters(tableName, filters);
      }

      const rawItems = data.Items || [];
      const plain = rawItems.map(fromDynamoItem);
      const { pk, sk } = getKeyInfo();
      const keyCols = [pk?.name, sk?.name].filter(Boolean);
      const colSet = new Set();
      plain.forEach(item => Object.keys(item).forEach(k => colSet.add(k)));
      const otherCols = [...colSet].filter(c => !keyCols.includes(c)).sort();
      setColumns([...keyCols, ...otherCols]);
      setItems(plain.map((item, i) => ({ ...item, _raw: rawItems[i] })));
      setHasRun(true);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRunning(false);
    }
  }

  function handleReset() {
    setFilters([]);
    setPkValue(''); setSkValue(''); setSkValue2(''); setSkCondition('=');
    setItems([]); setColumns([]); setHasRun(false);
  }

  function addFilter() {
    setFilters(prev => [...prev, { attribute: '', type: 'S', condition: '=', value: '', value2: '' }]);
  }

  /* ── Delete selected ─────────────────────────────────────────────── */
  async function handleDeleteSelected() {
    const { pk, sk } = getKeyInfo();
    const keyCols = [pk?.name, sk?.name].filter(Boolean);
    try {
      await Promise.all([...selectedRows].map(i => {
        const key = {};
        keyCols.forEach(k => { if (items[i]._raw?.[k]) key[k] = items[i]._raw[k]; });
        return deleteItem(tableName, key);
      }));
      showToast(`Deleted ${selectedRows.size} item${selectedRows.size !== 1 ? 's' : ''}.`);
      setDeleteConfirm(false); setSelectedRows(new Set());
      handleRun();
    } catch (err) { showToast(err.message, 'error'); }
  }

  /* ── Render ──────────────────────────────────────────────────────── */
  const tabs = ['overview', 'items', 'indexes', 'capacity', 'backups', 'monitoring'];
  const { pk, sk } = getKeyInfo();
  const arn = `arn:aws:dynamodb:ap-south-1:000000000000:table/${tableName}`;

  if (loading) return <div style={{ padding: 40, fontFamily: 'Arial' }}>Loading…</div>;
  if (error && !table) return (
    <div style={{ padding: 40, fontFamily: 'Arial' }}>
      <p style={{ color: '#d13212' }}>{error}</p>
      <button onClick={() => navigate('/dynamodb')} style={{ color: '#0073bb', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
    </div>
  );

  return (
    <div style={{ background: '#f2f3f3', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #d5dbdb', padding: '16px 24px' }}>
        <div style={{ fontSize: 12, color: '#545b64', marginBottom: 4 }}>
          <span onClick={() => navigate('/dynamodb')} style={{ color: '#0073bb', cursor: 'pointer' }}>DynamoDB</span>
          {' > '}
          <span onClick={() => navigate('/dynamodb')} style={{ color: '#0073bb', cursor: 'pointer' }}>Tables</span>
          {' > '}{tableName}
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: '#16191f' }}>{tableName}</h1>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #d5dbdb', paddingLeft: 24, display: 'flex' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: activeTab === tab ? 600 : 400,
            color: activeTab === tab ? '#ec7211' : '#545b64',
            borderBottom: activeTab === tab ? '2px solid #ec7211' : '2px solid transparent',
            textTransform: 'capitalize', marginBottom: -1,
          }}>{tab}</button>
        ))}
      </div>

      <div style={{ padding: 24 }}>

        {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
        {activeTab === 'overview' && table && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #d5dbdb', borderRadius: 4 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #eaeded' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#16191f' }}>General information</span>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Table name', value: tableName },
                  { label: 'ARN', value: arn, mono: true, small: true },
                  { label: 'Status', value: table.TableStatus, badge: true },
                  { label: 'Creation date', value: table.CreationDateTime ? new Date(table.CreationDateTime * 1000).toLocaleString() : '—' },
                  { label: 'Region', value: 'ap-south-1 (Mumbai)' },
                  { label: 'Table class', value: table.TableClassSummary?.TableClass || 'STANDARD' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                    <span style={{ fontSize: 13, color: '#545b64', flexShrink: 0 }}>{row.label}</span>
                    {row.badge ? (
                      <span style={{ background: '#eaf9ea', color: '#1a7c1a', fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 3 }}>{row.value}</span>
                    ) : (
                      <span style={{ fontSize: row.small ? 11 : 13, color: '#16191f', textAlign: 'right', fontFamily: row.mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{row.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #d5dbdb', borderRadius: 4 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #eaeded' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#16191f' }}>Key schema</span>
              </div>
              <div style={{ padding: 20 }}>
                {(table.KeySchema || []).map(k => {
                  const attr = (table.AttributeDefinitions || []).find(a => a.AttributeName === k.AttributeName);
                  return (
                    <div key={k.AttributeName} style={{ display: 'flex', gap: 16, padding: '8px 0', borderBottom: '1px solid #eaeded', fontSize: 14 }}>
                      <span style={{ fontFamily: 'monospace', color: '#16191f', fontWeight: 600, minWidth: 140 }}>{k.AttributeName}</span>
                      <span style={{ color: '#545b64', minWidth: 110 }}>{k.KeyType === 'HASH' ? 'Partition key' : 'Sort key'}</span>
                      <span style={{ color: '#545b64' }}>{attr ? TYPE_LABELS[attr.AttributeType] : ''}</span>
                    </div>
                  );
                })}
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Item count', value: table.ItemCount ?? items.length },
                    { label: 'Table size', value: table.TableSizeBytes != null ? `${table.TableSizeBytes} bytes` : '—' },
                    { label: 'Billing mode', value: table.BillingModeSummary?.BillingMode || 'PAY_PER_REQUEST' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: '#545b64' }}>{row.label}</span>
                      <span style={{ fontSize: 13, color: '#16191f', fontWeight: 500 }}>{String(row.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ITEMS TAB ────────────────────────────────────────────── */}
        {activeTab === 'items' && (
          <div>
            {/* Scan / Query panel */}
            <div style={{ background: '#fff', border: '1px solid #d5dbdb', borderRadius: '4px 4px 0 0', padding: '16px 20px' }}>

              {/* Mode switcher */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 16, border: '1px solid #aab7b8', borderRadius: 4, width: 'fit-content', overflow: 'hidden' }}>
                {['scan', 'query'].map(m => (
                  <button key={m} onClick={() => { setMode(m); setItems([]); setHasRun(false); setFilters([]); }} style={{
                    padding: '7px 20px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                    background: mode === m ? '#0073bb' : '#fff',
                    color: mode === m ? '#fff' : '#545b64',
                    textTransform: 'capitalize',
                  }}>{m}</button>
                ))}
              </div>

              {/* Mode description */}
              <div style={{ fontSize: 13, color: '#545b64', marginBottom: 16 }}>
                {mode === 'scan'
                  ? 'Scan reads every item in the table. Use filters to narrow results (filters apply after reading).'
                  : 'Query reads items using the partition key. Much faster and cheaper than Scan.'}
              </div>

              {/* Query: partition + sort key inputs */}
              {mode === 'query' && pk && (
                <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Partition key */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 200, fontSize: 13 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#16191f' }}>{pk.name}</span>
                      <span style={{ color: '#545b64', marginLeft: 6 }}>({TYPE_LABELS[pk.type]})</span>
                      <span style={{ marginLeft: 8, background: '#f0f4f8', border: '1px solid #d5dbdb', borderRadius: 3, padding: '1px 6px', fontSize: 11, color: '#545b64' }}>Partition key</span>
                    </div>
                    <span style={{ fontSize: 13, color: '#16191f', fontWeight: 500 }}>=</span>
                    <input
                      value={pkValue}
                      onChange={e => setPkValue(e.target.value)}
                      placeholder={`Enter ${pk.name}`}
                      style={{ padding: '7px 12px', fontSize: 14, border: '1px solid #aab7b8', borderRadius: 4, outline: 'none', width: 220 }}
                    />
                  </div>

                  {/* Sort key */}
                  {sk && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ minWidth: 200, fontSize: 13 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#16191f' }}>{sk.name}</span>
                        <span style={{ color: '#545b64', marginLeft: 6 }}>({TYPE_LABELS[sk.type]})</span>
                        <span style={{ marginLeft: 8, background: '#f0f4f8', border: '1px solid #d5dbdb', borderRadius: 3, padding: '1px 6px', fontSize: 11, color: '#545b64' }}>Sort key — optional</span>
                      </div>
                      <select value={skCondition} onChange={e => setSkCondition(e.target.value)}
                        style={{ padding: '7px 10px', fontSize: 13, border: '1px solid #aab7b8', borderRadius: 4, outline: 'none', background: '#fff' }}>
                        {SK_CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      <input value={skValue} onChange={e => setSkValue(e.target.value)}
                        placeholder={skCondition === 'between' ? 'From' : `Enter ${sk.name}`}
                        style={{ padding: '7px 12px', fontSize: 14, border: '1px solid #aab7b8', borderRadius: 4, outline: 'none', width: 160 }} />
                      {skCondition === 'between' && (
                        <input value={skValue2} onChange={e => setSkValue2(e.target.value)}
                          placeholder="To"
                          style={{ padding: '7px 12px', fontSize: 14, border: '1px solid #aab7b8', borderRadius: 4, outline: 'none', width: 130 }} />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Filter criteria */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#16191f', marginBottom: 8 }}>
                  Filter criteria
                  <span style={{ fontWeight: 400, color: '#687078', marginLeft: 6 }}>— optional</span>
                </div>
                {filters.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                    {filters.map((f, i) => (
                      <FilterRow
                        key={i}
                        filter={f}
                        onChange={updated => setFilters(prev => prev.map((x, idx) => idx === i ? updated : x))}
                        onRemove={() => setFilters(prev => prev.filter((_, idx) => idx !== i))}
                      />
                    ))}
                  </div>
                )}
                <button onClick={addFilter} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: '#fff', border: '1px solid #0073bb', color: '#0073bb',
                  borderRadius: 4, padding: '6px 12px', fontSize: 13, cursor: 'pointer',
                }}>
                  <Plus size={13} /> Add filter
                </button>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12, borderTop: '1px solid #eaeded' }}>
                <button onClick={handleRun} disabled={running} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px',
                  border: 'none', borderRadius: 4, background: running ? '#aab7b8' : '#0073bb',
                  color: '#fff', fontSize: 14, fontWeight: 500, cursor: running ? 'default' : 'pointer',
                }}>
                  <Play size={13} /> {running ? 'Running…' : 'Run'}
                </button>
                <button onClick={handleReset} style={{
                  padding: '8px 14px', border: '1px solid #aab7b8', borderRadius: 4,
                  background: '#fff', fontSize: 14, cursor: 'pointer', color: '#545b64',
                }}>
                  Reset
                </button>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                  {hasRun && (
                    <span style={{ fontSize: 13, color: '#545b64' }}>
                      {items.length} item{items.length !== 1 ? 's' : ''} returned
                    </span>
                  )}
                  <button onClick={() => { setShowCreateModal(true); }} style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                    border: 'none', borderRadius: 4, background: '#ec7211', color: '#fff', fontSize: 13, cursor: 'pointer',
                  }}>
                    <Plus size={13} /> Create item
                  </button>
                  {selectedRows.size > 0 && (
                    <button onClick={() => setDeleteConfirm(true)} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                      border: '1px solid #d13212', borderRadius: 4, background: '#fff',
                      color: '#d13212', fontSize: 13, cursor: 'pointer',
                    }}>
                      <Trash2 size={13} /> Delete ({selectedRows.size})
                    </button>
                  )}
                  <button onClick={handleRun} style={{ background: '#fff', border: '1px solid #aab7b8', borderRadius: 4, padding: '6px 10px', cursor: 'pointer' }}>
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Results table */}
            <div style={{ background: '#fff', border: '1px solid #d5dbdb', borderTop: 'none', borderRadius: '0 0 4px 4px', overflowX: 'auto' }}>
              {!hasRun ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#687078', fontSize: 14 }}>
                  Click <strong>Run</strong> to load items.
                </div>
              ) : items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: '#687078', fontSize: 14 }}>
                  <div style={{ marginBottom: 12, fontSize: 15, color: '#16191f' }}>No items found</div>
                  <div style={{ marginBottom: 16, fontSize: 13 }}>
                    {mode === 'query' ? 'No items match the partition key.' : 'Table is empty or no items match your filters.'}
                  </div>
                  <button onClick={() => setShowCreateModal(true)} style={{
                    background: '#ec7211', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', fontSize: 14, cursor: 'pointer',
                  }}>Create item</button>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                  <thead>
                    <tr style={{ background: '#fafafa', borderBottom: '1px solid #eaeded' }}>
                      <th style={{ width: 40, padding: '10px 16px' }}>
                        <input type="checkbox"
                          checked={selectedRows.size === items.length && items.length > 0}
                          onChange={() => selectedRows.size === items.length
                            ? setSelectedRows(new Set())
                            : setSelectedRows(new Set(items.map((_, i) => i)))}
                        />
                      </th>
                      {columns.map(col => (
                        <th key={col} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#16191f', fontFamily: 'monospace' }}>
                          {col}
                          {col === pk?.name && <span style={{ marginLeft: 4, fontSize: 10, background: '#0073bb', color: '#fff', padding: '1px 4px', borderRadius: 2 }}>PK</span>}
                          {col === sk?.name && <span style={{ marginLeft: 4, fontSize: 10, background: '#8c4fff', color: '#fff', padding: '1px 4px', borderRadius: 2 }}>SK</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eaeded', background: selectedRows.has(idx) ? '#f0f8ff' : '#fff' }}>
                        <td style={{ padding: '10px 16px' }}>
                          <input type="checkbox" checked={selectedRows.has(idx)} onChange={() => {
                            setSelectedRows(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
                          }} />
                        </td>
                        {columns.map(col => (
                          <td key={col} style={{ padding: '10px 16px', fontSize: 13, color: '#16191f', fontFamily: 'monospace', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item[col] !== undefined ? String(item[col]) : <span style={{ color: '#aab7b8' }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── PLACEHOLDER TABS ─────────────────────────────────────── */}
        {['indexes', 'capacity', 'backups', 'monitoring'].includes(activeTab) && (
          <div style={{ background: '#fff', border: '1px solid #d5dbdb', borderRadius: 4, padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>
              {activeTab === 'indexes' ? '🗂️' : activeTab === 'capacity' ? '⚡' : activeTab === 'backups' ? '💾' : '📊'}
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#16191f', textTransform: 'capitalize' }}>{activeTab}</h3>
            <p style={{ fontSize: 14, color: '#687078', maxWidth: 400, margin: '0 auto' }}>
              {activeTab === 'indexes' && 'Global and local secondary indexes for non-key queries.'}
              {activeTab === 'capacity' && 'Read/write capacity units and auto scaling settings.'}
              {activeTab === 'backups' && 'Point-in-time recovery and on-demand backups.'}
              {activeTab === 'monitoring' && 'CloudWatch metrics for capacity, throttling, and latency.'}
              {' '}Coming soon.
            </p>
          </div>
        )}
      </div>

      {/* Create Item Modal */}
      {showCreateModal && (
        <CreateItemModal
          tableName={tableName}
          keySchema={table?.KeySchema || []}
          attributeDefinitions={table?.AttributeDefinitions || []}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); handleRun(); showToast('Item created.'); }}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 4, padding: 24, width: 400, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 18, color: '#16191f' }}>Delete items</h3>
            <p style={{ fontSize: 14, color: '#545b64', margin: '0 0 20px' }}>
              Delete <strong>{selectedRows.size}</strong> selected item{selectedRows.size !== 1 ? 's' : ''}? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(false)} style={{ padding: '8px 16px', border: '1px solid #aab7b8', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={handleDeleteSelected} style={{ padding: '8px 16px', border: 'none', borderRadius: 4, background: '#d13212', color: '#fff', cursor: 'pointer', fontSize: 14 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ── Create Item Modal ─────────────────────────────────────────────── */
function CreateItemModal({ tableName, keySchema, attributeDefinitions, onClose, onCreated }) {
  const attrMap = Object.fromEntries(attributeDefinitions.map(a => [a.AttributeName, a.AttributeType]));
  const defaultItem = Object.fromEntries(keySchema.map(k => [k.AttributeName, attrMap[k.AttributeName] === 'N' ? 0 : '']));
  const [jsonStr, setJsonStr] = useState(JSON.stringify(defaultItem, null, 2));
  const [jsonError, setJsonError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setJsonError('');
    let item;
    try { item = parseItemJson(jsonStr); }
    catch { setJsonError('Invalid JSON — please fix the syntax.'); return; }
    for (const k of keySchema) {
      if (!item[k.AttributeName]) { setJsonError(`Key attribute "${k.AttributeName}" is required.`); return; }
    }
    setSaving(true);
    try { await putItem(tableName, item); onCreated(); }
    catch (err) { setJsonError(err.message); setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 4, width: 560, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eaeded', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Create item</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#545b64' }}>×</button>
        </div>
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          <div style={{ fontSize: 12, color: '#687078', marginBottom: 8 }}>
            Values auto-typed: numbers → N, everything else → S. Or use DynamoDB format: {`{"pk": {"S": "val"}}`}
          </div>
          <textarea value={jsonStr} onChange={e => { setJsonStr(e.target.value); setJsonError(''); }} spellCheck={false}
            style={{ width: '100%', height: 260, fontFamily: 'monospace', fontSize: 13, background: '#1e1e1e', color: '#d4d4d4', border: 'none', borderRadius: 4, padding: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
          />
          {jsonError && <div style={{ marginTop: 8, padding: '8px 12px', background: '#fdf3f1', border: '1px solid #f5a089', borderRadius: 4, color: '#d13212', fontSize: 13 }}>{jsonError}</div>}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid #eaeded', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #aab7b8', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '8px 16px', border: 'none', borderRadius: 4, background: saving ? '#aab7b8' : '#0073bb', color: '#fff', cursor: saving ? 'default' : 'pointer', fontSize: 14 }}>
            {saving ? 'Creating…' : 'Create item'}
          </button>
        </div>
      </div>
    </div>
  );
}
