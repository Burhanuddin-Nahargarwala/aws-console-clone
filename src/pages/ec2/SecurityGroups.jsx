import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, X, ChevronDown, ChevronRight } from 'lucide-react';
import { describeSecurityGroups, createSecurityGroup, deleteSecurityGroup, authorizeIngressRule } from '../../lib/ec2Client';
import { useRegion } from '../../lib/RegionContext';

function RuleRow({ rule }) {
  const proto = rule.IpProtocol === '-1' ? 'All traffic' : rule.IpProtocol?.toUpperCase();
  const port  = rule.IpProtocol === '-1' ? 'All'
    : rule.FromPort === rule.ToPort ? String(rule.FromPort)
    : `${rule.FromPort}–${rule.ToPort}`;
  const cidrs = (rule.IpRanges || []).map(r => r.CidrIp).join(', ') || '—';
  return (
    <tr>
      <td style={{ fontSize: 12 }}>{proto}</td>
      <td style={{ fontSize: 12 }}>{port}</td>
      <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{cidrs}</td>
    </tr>
  );
}

function SGCard({ sg, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: '1px solid var(--aws-border)', borderRadius: 4, marginBottom: 10, overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: '#fafafa' }}
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
        <span style={{ fontWeight: 600, fontSize: 13 }}>{sg.GroupName}</span>
        <span style={{ fontSize: 12, color: 'var(--aws-text-secondary)' }}>{sg.GroupId}</span>
        <span style={{ fontSize: 12, color: 'var(--aws-text-secondary)', flex: 1 }}>{sg.Description}</span>
        {sg.GroupName !== 'default' && (
          <button
            className="aws-btn-link"
            style={{ color: 'var(--aws-error)', fontSize: 12 }}
            onClick={e => { e.stopPropagation(); onDelete(sg.GroupId, sg.GroupName); }}
          >
            Delete
          </button>
        )}
      </div>
      {open && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--aws-border)' }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Inbound rules</div>
          {(sg.IpPermissions || []).length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--aws-text-secondary)' }}>No inbound rules.</p>
          ) : (
            <table className="aws-table" style={{ fontSize: 12 }}>
              <thead><tr><th>Protocol</th><th>Port range</th><th>Source</th></tr></thead>
              <tbody>{sg.IpPermissions.map((r, i) => <RuleRow key={i} rule={r}/>)}</tbody>
            </table>
          )}
          <div style={{ fontWeight: 600, fontSize: 12, margin: '12px 0 6px' }}>Outbound rules</div>
          {(sg.IpPermissionsEgress || []).length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--aws-text-secondary)' }}>No outbound rules.</p>
          ) : (
            <table className="aws-table" style={{ fontSize: 12 }}>
              <thead><tr><th>Protocol</th><th>Port range</th><th>Destination</th></tr></thead>
              <tbody>{sg.IpPermissionsEgress.map((r, i) => <RuleRow key={i} rule={r}/>)}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default function SecurityGroups() {
  const { region } = useRegion();
  const [groups, setGroups]        = useState([]);
  const [loading, setLoading]      = useState(true);
  const [error, setError]          = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]      = useState('');
  const [newDesc, setNewDesc]      = useState('');
  const [creating, setCreating]    = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setGroups(await describeSecurityGroups());
    } catch (err) {
      setError('Failed to load security groups: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [region]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const id = await createSecurityGroup({ groupName: newName.trim(), description: newDesc.trim() || newName.trim() });
      // Add default SSH + HTTP rules
      try {
        await authorizeIngressRule(id, { protocol: 'tcp', fromPort: 22, toPort: 22, cidr: '0.0.0.0/0' });
        await authorizeIngressRule(id, { protocol: 'tcp', fromPort: 80, toPort: 80, cidr: '0.0.0.0/0' });
        await authorizeIngressRule(id, { protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '0.0.0.0/0' });
      } catch { /* rules may fail silently */ }
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      load();
    } catch (err) {
      setError('Failed to create security group: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, name) => {
    try {
      await deleteSecurityGroup(id);
      setDeleteConfirm(null);
      load();
    } catch (err) {
      setError(`Failed to delete "${name}": ${err.message}`);
      setDeleteConfirm(null);
    }
  };

  return (
    <div>
      {deleteConfirm && (
        <div className="aws-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="aws-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="aws-modal-header">
              <h2>Delete security group</h2>
              <button className="aws-btn-link" onClick={() => setDeleteConfirm(null)}><X size={16}/></button>
            </div>
            <div className="aws-modal-body">
              <p style={{ fontSize: 13 }}>Delete <strong>{deleteConfirm.name}</strong> ({deleteConfirm.id})?</p>
            </div>
            <div className="aws-modal-footer">
              <button className="aws-btn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                className="aws-btn"
                style={{ background: 'var(--aws-error)', color: 'white', borderColor: 'var(--aws-error)' }}
                onClick={() => handleDelete(deleteConfirm.id, deleteConfirm.name)}
              >Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="aws-breadcrumb">
        <span style={{ color: 'var(--aws-text-secondary)' }}>EC2</span>
        <span className="aws-breadcrumb-sep">›</span>
        <span style={{ color: 'var(--aws-text-secondary)' }}>Network & Security</span>
        <span className="aws-breadcrumb-sep">›</span>
        <span style={{ fontWeight: 700 }}>Security Groups</span>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Security Groups</h1>
      <p style={{ color: 'var(--aws-text-secondary)', fontSize: 13, marginBottom: 20 }}>
        A security group acts as a virtual firewall, controlling inbound and outbound traffic for your instances.
      </p>

      {error && (
        <div className="aws-alert aws-alert-error" style={{ marginBottom: 16 }}>
          <X size={16} color="var(--aws-error)" style={{ flexShrink: 0 }}/>
          <span style={{ fontSize: 13 }}>{error}</span>
          <button className="aws-btn-link" style={{ marginLeft: 'auto' }} onClick={() => setError('')}><X size={14}/></button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>
          Security groups
          <span style={{ fontWeight: 400, color: 'var(--aws-text-secondary)', fontSize: 13 }}> ({groups.length})</span>
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="aws-btn-icon" onClick={load} disabled={loading} title="Refresh">
            <RefreshCw size={14} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }}/>
          </button>
          <button className="aws-btn aws-btn-primary" onClick={() => setShowCreate(v => !v)}>
            <Plus size={13}/> Create security group
          </button>
        </div>
      </div>

      {/* Inline create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="aws-panel" style={{ marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="aws-form-field" style={{ margin: 0 }}>
            <label className="aws-form-label" style={{ marginBottom: 4 }}>Name</label>
            <input type="text" className="aws-input" placeholder="my-security-group"
              value={newName} onChange={e => setNewName(e.target.value)} autoFocus style={{ width: 220 }}/>
          </div>
          <div className="aws-form-field" style={{ margin: 0 }}>
            <label className="aws-form-label" style={{ marginBottom: 4 }}>Description</label>
            <input type="text" className="aws-input" placeholder="My security group"
              value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ width: 280 }}/>
          </div>
          <button type="submit" className="aws-btn aws-btn-primary" disabled={creating || !newName.trim()}>
            {creating ? 'Creating…' : 'Create'}
          </button>
          <button type="button" className="aws-btn" onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); }}>Cancel</button>
          <p style={{ width: '100%', fontSize: 12, color: 'var(--aws-text-secondary)', margin: 0 }}>
            SSH (22), HTTP (80), and HTTPS (443) inbound rules are added automatically.
          </p>
        </form>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--aws-text-secondary)' }}>
          <span className="aws-spinner"/> Loading…
        </div>
      ) : groups.length === 0 ? (
        <div className="aws-panel">
          <div className="aws-empty-state">
            <div className="aws-empty-state-title">No security groups</div>
            <div className="aws-empty-state-desc">Create a security group to control traffic to your instances.</div>
            <button className="aws-btn aws-btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={13}/> Create security group
            </button>
          </div>
        </div>
      ) : (
        groups.map(sg => (
          <SGCard
            key={sg.GroupId}
            sg={sg}
            onDelete={(id, name) => setDeleteConfirm({ id, name })}
          />
        ))
      )}
    </div>
  );
}
