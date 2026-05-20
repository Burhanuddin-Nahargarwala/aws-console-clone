import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Plus, X, Search } from 'lucide-react';
import {
  describeInstances, startInstances, stopInstances, terminateInstances,
  getInstanceName, STATE_COLOR,
} from '../../lib/ec2Client';
import { useRegion } from '../../lib/RegionContext';

function StateBadge({ state }) {
  const s = state?.Name || 'unknown';
  const c = STATE_COLOR[s] || STATE_COLOR.terminated;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12,
      background: c.bg, color: c.color, borderRadius: 10, padding: '2px 8px', fontWeight: 500 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0 }}/>
      {s}
    </span>
  );
}

function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onClose }) {
  return (
    <div className="aws-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="aws-modal" style={{ maxWidth: 440 }}>
        <div className="aws-modal-header">
          <h2>{title}</h2>
          <button className="aws-btn-link" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="aws-modal-body">
          <p style={{ fontSize: 13 }}>{message}</p>
        </div>
        <div className="aws-modal-footer">
          <button className="aws-btn" onClick={onClose}>Cancel</button>
          <button
            className="aws-btn"
            style={danger ? { background: 'var(--aws-error)', color: 'white', borderColor: 'var(--aws-error)' } : {}}
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InstanceList() {
  const navigate = useNavigate();
  const { region } = useRegion();
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // { type, ids }
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await describeInstances();
      // exclude fully terminated instances older than session
      setInstances(data.filter(i => i.State?.Name !== 'terminated'));
    } catch (err) {
      setError('Could not connect to EC2. Make sure Floci is running on port 4566.');
    } finally {
      setLoading(false);
    }
  }, [region]);

  useEffect(() => { load(); setSelected(new Set()); }, [load]);

  const filtered = instances.filter(i => {
    if (!search) return true;
    const name = getInstanceName(i).toLowerCase();
    return name.includes(search.toLowerCase()) || i.InstanceId.includes(search);
  });

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedList = [...selected];
  const selectedInstances = instances.filter(i => selected.has(i.InstanceId));
  const allRunning  = selectedInstances.every(i => i.State?.Name === 'running');
  const allStopped  = selectedInstances.every(i => i.State?.Name === 'stopped');
  const canStart    = selectedList.length > 0 && allStopped;
  const canStop     = selectedList.length > 0 && allRunning;
  const canTerminate = selectedList.length > 0;

  const doAction = async (action) => {
    setActionLoading(true);
    try {
      if (action === 'start')     await startInstances(selectedList);
      if (action === 'stop')      await stopInstances(selectedList);
      if (action === 'terminate') await terminateInstances(selectedList);
      setSelected(new Set());
      setTimeout(load, 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      {modal?.type === 'stop' && (
        <ConfirmModal
          title="Stop instances"
          message={`Stop ${selectedList.length} instance(s)? They can be restarted later.`}
          confirmLabel="Stop"
          onConfirm={() => doAction('stop')}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'terminate' && (
        <ConfirmModal
          title="Terminate instances"
          message={`Terminate ${selectedList.length} instance(s)? This is permanent and cannot be undone.`}
          confirmLabel="Terminate"
          danger
          onConfirm={() => doAction('terminate')}
          onClose={() => setModal(null)}
        />
      )}

      <div className="aws-breadcrumb">
        <span style={{ color: 'var(--aws-text-secondary)' }}>EC2</span>
        <span className="aws-breadcrumb-sep">›</span>
        <span style={{ fontWeight: 700 }}>Instances</span>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Instances</h1>
      <p style={{ color: 'var(--aws-text-secondary)', fontSize: 13, marginBottom: 20 }}>
        An instance is a virtual server in the AWS Cloud.
      </p>

      {error && (
        <div className="aws-alert aws-alert-error" style={{ marginBottom: 16 }}>
          <X size={16} color="var(--aws-error)" style={{ flexShrink: 0 }}/>
          <span style={{ fontSize: 13 }}>{error}</span>
          <button className="aws-btn-link" style={{ marginLeft: 'auto' }} onClick={() => setError('')}><X size={14}/></button>
        </div>
      )}

      <div className="aws-panel" style={{ padding: 0 }}>
        {/* Toolbar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--aws-border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            Instances
            <span style={{ fontWeight: 400, color: 'var(--aws-text-secondary)', fontSize: 13 }}> ({filtered.length})</span>
          </span>

          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--aws-text-secondary)', pointerEvents: 'none' }}/>
            <input
              type="text" className="aws-input" placeholder="Filter instances"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 30, width: 220 }}
            />
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="aws-btn-icon" onClick={load} disabled={loading} title="Refresh">
              <RefreshCw size={14} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }}/>
            </button>
            <button className="aws-btn" disabled={!canStart || actionLoading}
              onClick={() => doAction('start')}>
              Start instance
            </button>
            <button className="aws-btn" disabled={!canStop || actionLoading}
              onClick={() => setModal({ type: 'stop' })}>
              Stop instance
            </button>
            <button className="aws-btn" disabled={!canTerminate || actionLoading}
              style={canTerminate ? { color: 'var(--aws-error)', borderColor: 'var(--aws-error)' } : {}}
              onClick={() => setModal({ type: 'terminate' })}>
              Terminate
            </button>
            <button className="aws-btn aws-btn-primary" onClick={() => navigate('/ec2/launch')}>
              <Plus size={14}/> Launch instance
            </button>
          </div>
        </div>

        {/* Table */}
        <table className="aws-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}/>
              <th>Instance ID</th>
              <th>Name</th>
              <th>Instance state</th>
              <th>Instance type</th>
              <th>Public IPv4</th>
              <th>AMI ID</th>
              <th>Key pair</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--aws-text-secondary)' }}>
                    <span className="aws-spinner"/> Loading instances…
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="aws-empty-state">
                    <div className="aws-empty-state-title">
                      {search ? `No instances match "${search}"` : 'No instances'}
                    </div>
                    <div className="aws-empty-state-desc">
                      {search ? 'Clear the search to see all instances.' : 'Launch your first EC2 instance to get started.'}
                    </div>
                    {!search && (
                      <button className="aws-btn aws-btn-primary" onClick={() => navigate('/ec2/launch')}>
                        <Plus size={14}/> Launch instance
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map(inst => (
                <tr
                  key={inst.InstanceId}
                  className={selected.has(inst.InstanceId) ? 'selected' : ''}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/ec2/instance/${inst.InstanceId}`)}
                >
                  <td style={{ textAlign: 'center' }} onClick={e => { e.stopPropagation(); toggleSelect(inst.InstanceId); }}>
                    <input type="checkbox" checked={selected.has(inst.InstanceId)} onChange={() => {}} style={{ width: 14, height: 14 }}/>
                  </td>
                  <td>
                    <span style={{ color: 'var(--aws-blue)', fontWeight: 500 }}>{inst.InstanceId}</span>
                  </td>
                  <td>{getInstanceName(inst)}</td>
                  <td><StateBadge state={inst.State}/></td>
                  <td style={{ color: 'var(--aws-text-secondary)' }}>{inst.InstanceType}</td>
                  <td style={{ color: 'var(--aws-text-secondary)' }}>{inst.PublicIpAddress || '—'}</td>
                  <td style={{ color: 'var(--aws-text-secondary)', fontSize: 12 }}>{inst.ImageId}</td>
                  <td style={{ color: 'var(--aws-text-secondary)' }}>{inst.KeyName || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
