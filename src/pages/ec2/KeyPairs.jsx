import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, X, Download } from 'lucide-react';
import { describeKeyPairs, createKeyPair, deleteKeyPair } from '../../lib/ec2Client';
import { useRegion } from '../../lib/RegionContext';

export default function KeyPairs() {
  const { region } = useRegion();
  const [keyPairs, setKeyPairs] = useState([]);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]  = useState('');
  const [creating, setCreating] = useState(false);
  const [pemContent, setPemContent] = useState('');
  const [pemName, setPemName]  = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setKeyPairs(await describeKeyPairs());
    } catch (err) {
      setError('Failed to load key pairs: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [region]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const result = await createKeyPair(newName.trim());
      setPemContent(result.KeyMaterial || '');
      setPemName(newName.trim());
      setShowCreate(false);
      setNewName('');
      load();
    } catch (err) {
      setError('Failed to create key pair: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const downloadPem = () => {
    if (!pemContent) return;
    const blob = new Blob([pemContent], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${pemName}.pem`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (keyName) => {
    try {
      await deleteKeyPair(keyName);
      setDeleteConfirm(null);
      load();
    } catch (err) {
      setError('Failed to delete key pair: ' + err.message);
    }
  };

  return (
    <div>
      {deleteConfirm && (
        <div className="aws-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="aws-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="aws-modal-header">
              <h2>Delete key pair</h2>
              <button className="aws-btn-link" onClick={() => setDeleteConfirm(null)}><X size={16}/></button>
            </div>
            <div className="aws-modal-body">
              <p style={{ fontSize: 13 }}>
                Delete key pair <strong>{deleteConfirm}</strong>? Any instances using this key pair will no longer be accessible after deletion.
              </p>
            </div>
            <div className="aws-modal-footer">
              <button className="aws-btn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                className="aws-btn"
                style={{ background: 'var(--aws-error)', color: 'white', borderColor: 'var(--aws-error)' }}
                onClick={() => handleDelete(deleteConfirm)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="aws-breadcrumb">
        <span style={{ color: 'var(--aws-text-secondary)' }}>EC2</span>
        <span className="aws-breadcrumb-sep">›</span>
        <span style={{ color: 'var(--aws-text-secondary)' }}>Network & Security</span>
        <span className="aws-breadcrumb-sep">›</span>
        <span style={{ fontWeight: 700 }}>Key Pairs</span>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Key Pairs</h1>
      <p style={{ color: 'var(--aws-text-secondary)', fontSize: 13, marginBottom: 20 }}>
        A key pair consists of a public key (stored by AWS) and a private key (downloaded by you). Used for SSH access to instances.
      </p>

      {pemContent && (
        <div className="aws-alert" style={{ marginBottom: 16, background: '#d4edda', borderColor: '#c3e6cb', alignItems: 'center' }}>
          <span style={{ fontSize: 13, flex: 1 }}>
            <strong>Key pair "{pemName}" created.</strong> Download your private key now — this is the only time it will be available.
          </span>
          <button className="aws-btn" style={{ background: '#155724', color: 'white', borderColor: '#155724', flexShrink: 0 }} onClick={downloadPem}>
            <Download size={13}/> Download {pemName}.pem
          </button>
          <button className="aws-btn-link" onClick={() => setPemContent('')}><X size={14}/></button>
        </div>
      )}

      {error && (
        <div className="aws-alert aws-alert-error" style={{ marginBottom: 16 }}>
          <X size={16} color="var(--aws-error)" style={{ flexShrink: 0 }}/>
          <span style={{ fontSize: 13 }}>{error}</span>
          <button className="aws-btn-link" style={{ marginLeft: 'auto' }} onClick={() => setError('')}><X size={14}/></button>
        </div>
      )}

      <div className="aws-panel" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--aws-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            Key pairs
            <span style={{ fontWeight: 400, color: 'var(--aws-text-secondary)', fontSize: 13 }}> ({keyPairs.length})</span>
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="aws-btn-icon" onClick={load} disabled={loading} title="Refresh">
              <RefreshCw size={14} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }}/>
            </button>
            <button className="aws-btn aws-btn-primary" onClick={() => setShowCreate(v => !v)}>
              <Plus size={13}/> Create key pair
            </button>
          </div>
        </div>

        {/* Inline create form */}
        {showCreate && (
          <form onSubmit={handleCreate} style={{ padding: '14px 16px', borderBottom: '1px solid var(--aws-border)', background: '#f7f9fa', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div className="aws-form-field" style={{ margin: 0 }}>
              <label className="aws-form-label" style={{ marginBottom: 4 }}>Key pair name</label>
              <input
                type="text" className="aws-input" placeholder="my-key-pair"
                value={newName} onChange={e => setNewName(e.target.value)}
                autoFocus style={{ width: 260 }}
              />
            </div>
            <button type="submit" className="aws-btn aws-btn-primary" disabled={creating || !newName.trim()}>
              {creating ? 'Creating…' : 'Create & download .pem'}
            </button>
            <button type="button" className="aws-btn" onClick={() => { setShowCreate(false); setNewName(''); }}>Cancel</button>
          </form>
        )}

        <table className="aws-table">
          <thead>
            <tr>
              <th>Key pair name</th>
              <th>Key pair ID</th>
              <th>Fingerprint</th>
              <th style={{ width: 80 }}/>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--aws-text-secondary)' }}>
                    <span className="aws-spinner"/> Loading…
                  </div>
                </td>
              </tr>
            ) : keyPairs.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="aws-empty-state">
                    <div className="aws-empty-state-title">No key pairs</div>
                    <div className="aws-empty-state-desc">Create a key pair to enable SSH access to your instances.</div>
                    <button className="aws-btn aws-btn-primary" onClick={() => setShowCreate(true)}>
                      <Plus size={13}/> Create key pair
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              keyPairs.map(kp => (
                <tr key={kp.KeyPairId || kp.KeyName}>
                  <td style={{ fontWeight: 500 }}>{kp.KeyName}</td>
                  <td style={{ color: 'var(--aws-text-secondary)', fontSize: 12 }}>{kp.KeyPairId || '—'}</td>
                  <td style={{ color: 'var(--aws-text-secondary)', fontSize: 11, fontFamily: 'monospace' }}>
                    {kp.KeyFingerprint ? kp.KeyFingerprint.slice(0, 32) + '…' : '—'}
                  </td>
                  <td>
                    <button
                      className="aws-btn-link"
                      style={{ color: 'var(--aws-error)', fontSize: 12 }}
                      onClick={() => setDeleteConfirm(kp.KeyName)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
