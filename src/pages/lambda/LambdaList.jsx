import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { listFunctions, deleteFunction } from '../../lib/lambdaStore';
import { useRegion } from '../../lib/RegionContext';

const RUNTIME_LABELS = {
  'nodejs20.x': 'Node.js 20.x',
  'nodejs18.x': 'Node.js 18.x',
  'python3.12': 'Python 3.12',
  'python3.11': 'Python 3.11',
};

export default function LambdaList() {
  const navigate = useNavigate();
  const { region } = useRegion();
  const [functions, setFunctions] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const fns = await listFunctions(region);
      setFunctions(fns);
    } catch (err) {
      setError('Could not reach backend. Make sure it is running on port 3001.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [region]);

  const filtered = functions.filter(f =>
    f.functionName.toLowerCase().includes(search.toLowerCase())
  );

  function toggleSelect(name) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(f => f.functionName)));
    }
  }

  async function handleDelete(name) {
    try {
      await deleteFunction(name);
    } catch (err) {
      setError(err.message);
    }
    setSelected(prev => { const n = new Set(prev); n.delete(name); return n; });
    setDeleteConfirm(null);
    load();
  }

  return (
    <div style={{ background: '#f2f3f3', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Page header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #d5dbdb', padding: '16px 24px' }}>
        <div style={{ fontSize: 12, color: '#545b64', marginBottom: 4 }}>
          <span style={{ color: '#0073bb', cursor: 'pointer' }}>Lambda</span>
          {' > '}Functions
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: '#16191f' }}>Functions</h1>
          <button
            onClick={() => navigate('/lambda/create')}
            style={{
              background: '#ec7211', color: '#fff', border: 'none', borderRadius: 4,
              padding: '8px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Plus size={14} /> Create function
          </button>
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        {error && (
          <div style={{ padding: '12px 16px', background: '#fdf3f1', border: '1px solid #f5a089', borderRadius: 4, color: '#d13212', fontSize: 14, marginBottom: 16 }}>
            {error}
          </div>
        )}
        {/* Toolbar */}
        <div style={{
          background: '#fff', border: '1px solid #d5dbdb', borderRadius: '4px 4px 0 0',
          padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', border: '1px solid #aab7b8',
              borderRadius: 4, background: '#fff', overflow: 'hidden',
            }}>
              <Search size={14} style={{ color: '#687078', margin: '0 8px' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter by function name"
                style={{
                  border: 'none', outline: 'none', fontSize: 14, padding: '6px 8px 6px 0',
                  width: 240, color: '#16191f',
                }}
              />
            </div>
            <button
              onClick={load}
              style={{ background: '#fff', border: '1px solid #aab7b8', borderRadius: 4, padding: '6px 10px', cursor: 'pointer' }}
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <span style={{ fontSize: 13, color: '#545b64' }}>
            {loading ? 'Loading…' : `${filtered.length} function${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Table */}
        <div style={{
          background: '#fff', border: '1px solid #d5dbdb', borderTop: 'none',
          borderRadius: '0 0 4px 4px', overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '1px solid #eaeded' }}>
                <th style={{ width: 40, padding: '10px 16px' }}>
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                {['Function name', 'Description', 'Runtime', 'Last modified', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#16191f' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px 16px', color: '#687078', fontSize: 14 }}>
                    {search ? 'No functions match your filter.' : (
                      <>
                        <div style={{ marginBottom: 12, fontSize: 15, color: '#16191f' }}>No functions yet</div>
                        <button
                          onClick={() => navigate('/lambda/create')}
                          style={{
                            background: '#ec7211', color: '#fff', border: 'none', borderRadius: 4,
                            padding: '8px 16px', fontSize: 14, cursor: 'pointer',
                          }}
                        >
                          Create your first function
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ) : filtered.map(fn => (
                <tr
                  key={fn.functionName}
                  style={{ borderBottom: '1px solid #eaeded', background: selected.has(fn.functionName) ? '#f0f8ff' : '#fff' }}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <input type="checkbox" checked={selected.has(fn.functionName)} onChange={() => toggleSelect(fn.functionName)} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      onClick={() => navigate(`/lambda/function/${fn.functionName}`)}
                      style={{ color: '#0073bb', cursor: 'pointer', fontWeight: 500, fontSize: 14 }}
                    >
                      {fn.functionName}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 14, color: '#545b64' }}>{fn.description || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, color: '#16191f' }}>{RUNTIME_LABELS[fn.runtime] || fn.runtime}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, color: '#545b64' }}>
                    {new Date(fn.lastModified).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => setDeleteConfirm(fn.functionName)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d13212', padding: 4 }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete modal */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{ background: '#fff', borderRadius: 4, padding: 24, width: 420, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 18, color: '#16191f' }}>Delete function</h3>
            <p style={{ fontSize: 14, color: '#545b64', margin: '0 0 20px' }}>
              Are you sure you want to delete <strong>{deleteConfirm}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{ padding: '8px 16px', border: '1px solid #aab7b8', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{ padding: '8px 16px', border: 'none', borderRadius: 4, background: '#d13212', color: '#fff', cursor: 'pointer', fontSize: 14 }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
