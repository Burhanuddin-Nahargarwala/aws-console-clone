import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { listTables, describeTable, deleteTable } from '../../lib/dynamoClient';
import { useRegion } from '../../lib/RegionContext';

export default function DynamoDBList() {
  const navigate = useNavigate();
  const { region } = useRegion();
  const [tables, setTables] = useState([]);
  const [tableDetails, setTableDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const names = await listTables();
      setTables(names);
      // Load details for each table in parallel
      const details = await Promise.allSettled(names.map(n => describeTable(n)));
      const detailMap = {};
      names.forEach((n, i) => {
        if (details[i].status === 'fulfilled') detailMap[n] = details[i].value;
      });
      setTableDetails(detailMap);
    } catch (err) {
      setError('Could not connect to DynamoDB. Make sure Floci is running on port 4566.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [region]);

  const filtered = tables.filter(t => t.toLowerCase().includes(search.toLowerCase()));

  function toggleSelect(name) {
    setSelected(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }

  async function handleDelete(name) {
    setDeleting(true);
    try {
      await deleteTable(name);
      setDeleteConfirm(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  function getKeySchema(name) {
    const detail = tableDetails[name];
    if (!detail) return { pk: '—', sk: '—' };
    const ks = detail.KeySchema || [];
    const attrs = Object.fromEntries((detail.AttributeDefinitions || []).map(a => [a.AttributeName, a.AttributeType]));
    const pk = ks.find(k => k.KeyType === 'HASH');
    const sk = ks.find(k => k.KeyType === 'RANGE');
    const typeLabel = { S: 'String', N: 'Number', B: 'Binary' };
    return {
      pk: pk ? `${pk.AttributeName} (${typeLabel[attrs[pk.AttributeName]] || ''})` : '—',
      sk: sk ? `${sk.AttributeName} (${typeLabel[attrs[sk.AttributeName]] || ''})` : '—',
    };
  }

  return (
    <div style={{ background: '#f2f3f3', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #d5dbdb', padding: '16px 24px' }}>
        <div style={{ fontSize: 12, color: '#545b64', marginBottom: 4 }}>
          <span style={{ color: '#0073bb' }}>DynamoDB</span> {' > '} Tables
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: '#16191f' }}>Tables</h1>
          <button
            onClick={() => navigate('/dynamodb/create')}
            style={{
              background: '#ec7211', color: '#fff', border: 'none', borderRadius: 4,
              padding: '8px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Plus size={14} /> Create table
          </button>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {error && (
          <div style={{
            padding: '12px 16px', background: '#fdf3f1', border: '1px solid #f5a089',
            borderRadius: 4, color: '#d13212', fontSize: 14, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Toolbar */}
        <div style={{
          background: '#fff', border: '1px solid #d5dbdb', borderRadius: '4px 4px 0 0',
          padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #aab7b8', borderRadius: 4, background: '#fff', overflow: 'hidden' }}>
              <Search size={14} style={{ color: '#687078', margin: '0 8px' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter by table name"
                style={{ border: 'none', outline: 'none', fontSize: 14, padding: '6px 8px 6px 0', width: 220 }}
              />
            </div>
            <button onClick={load} style={{ background: '#fff', border: '1px solid #aab7b8', borderRadius: 4, padding: '6px 10px', cursor: 'pointer' }}>
              <RefreshCw size={14} />
            </button>
          </div>
          <span style={{ fontSize: 13, color: '#545b64' }}>
            {loading ? 'Loading…' : `${filtered.length} table${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', border: '1px solid #d5dbdb', borderTop: 'none', borderRadius: '0 0 4px 4px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '1px solid #eaeded' }}>
                <th style={{ width: 40, padding: '10px 16px' }}>
                  <input type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={() => selected.size === filtered.length ? setSelected(new Set()) : setSelected(new Set(filtered))}
                  />
                </th>
                {['Table name', 'Status', 'Partition key', 'Sort key', 'Item count', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#16191f' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#687078' }}>Loading tables…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: '#687078', fontSize: 14 }}>
                    {search ? 'No tables match your filter.' : (
                      <>
                        <div style={{ marginBottom: 12, fontSize: 15, color: '#16191f' }}>No tables yet</div>
                        <button
                          onClick={() => navigate('/dynamodb/create')}
                          style={{ background: '#ec7211', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}
                        >
                          Create your first table
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ) : filtered.map(name => {
                const detail = tableDetails[name];
                const { pk, sk } = getKeySchema(name);
                return (
                  <tr key={name} style={{ borderBottom: '1px solid #eaeded', background: selected.has(name) ? '#f0f8ff' : '#fff' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <input type="checkbox" checked={selected.has(name)} onChange={() => toggleSelect(name)} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span onClick={() => navigate(`/dynamodb/table/${name}`)}
                        style={{ color: '#0073bb', cursor: 'pointer', fontWeight: 500, fontSize: 14 }}>
                        {name}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: '#eaf9ea', color: '#1a7c1a', fontSize: 12, fontWeight: 600,
                        padding: '2px 8px', borderRadius: 3,
                      }}>
                        {detail?.TableStatus || 'ACTIVE'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 14, color: '#16191f', fontFamily: 'monospace' }}>{pk}</td>
                    <td style={{ padding: '12px 16px', fontSize: 14, color: '#16191f', fontFamily: 'monospace' }}>{sk}</td>
                    <td style={{ padding: '12px 16px', fontSize: 14, color: '#545b64' }}>
                      {detail?.ItemCount ?? '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => setDeleteConfirm(name)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d13212', padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 4, padding: 24, width: 420, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 18, color: '#16191f' }}>Delete table</h3>
            <p style={{ fontSize: 14, color: '#545b64', margin: '0 0 20px' }}>
              Are you sure you want to delete <strong>{deleteConfirm}</strong>?
              All items in the table will be permanently deleted.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding: '8px 16px', border: '1px solid #aab7b8', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting}
                style={{ padding: '8px 16px', border: 'none', borderRadius: 4, background: '#d13212', color: '#fff', cursor: 'pointer', fontSize: 14 }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
