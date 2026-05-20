import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { RefreshCw, X, Terminal } from 'lucide-react';
import {
  describeInstances, startInstances, stopInstances, terminateInstances,
  getInstanceName, STATE_COLOR, MOCK_AMIS,
} from '../../lib/ec2Client';

function StateBadge({ state }) {
  const s = state?.Name || 'unknown';
  const c = STATE_COLOR[s] || STATE_COLOR.terminated;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13,
      background: c.bg, color: c.color, borderRadius: 10, padding: '3px 10px', fontWeight: 500 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }}/>
      {s}
    </span>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--aws-border)' }}>
      <span style={{ fontSize: 13, color: 'var(--aws-text-secondary)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, wordBreak: 'break-all' }}>{value || '—'}</span>
    </div>
  );
}

function ConnectModal({ instance, onClose }) {
  const ami     = MOCK_AMIS.find(a => a.id === instance?.ImageId);
  const user    = ami?.user || 'ec2-user';
  const ip      = instance?.PublicIpAddress || '<public-ip>';
  const keyName = instance?.KeyName;
  const sshCmd  = `ssh -i "${keyName || 'my-key'}.pem" ${user}@${ip}`;

  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(sshCmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="aws-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="aws-modal" style={{ maxWidth: 580 }}>
        <div className="aws-modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={18}/> Connect to instance
          </h2>
          <button className="aws-btn-link" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="aws-modal-body">

          <div className="aws-alert" style={{ marginBottom: 16, background: '#fff3cd', borderColor: '#ffeaa7' }}>
            <span style={{ fontSize: 13 }}>
              <strong>Local simulation note:</strong> Floci runs mock instances — SSH connection won't work locally.
              This command is exactly what you'd use with a real AWS instance.
            </span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Instance details</div>
            <DetailRow label="Instance ID" value={instance?.InstanceId}/>
            <DetailRow label="Public IPv4" value={instance?.PublicIpAddress}/>
            <DetailRow label="Username" value={user}/>
            <DetailRow label="Key pair" value={keyName}/>
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>SSH connection command</div>

          {!keyName && (
            <div className="aws-alert aws-alert-error" style={{ marginBottom: 10 }}>
              <X size={14} color="var(--aws-error)" style={{ flexShrink: 0 }}/>
              <span style={{ fontSize: 12 }}>This instance was launched without a key pair. SSH access is not possible.</span>
            </div>
          )}

          <div style={{ background: '#0d1117', borderRadius: 4, padding: '10px 14px', fontFamily: 'monospace', fontSize: 13, color: '#c9d1d9', position: 'relative' }}>
            {sshCmd}
            <button
              onClick={copy}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: copied ? '#28a745' : '#30363d', color: 'white', border: 'none', borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div style={{ fontSize: 12, color: 'var(--aws-text-secondary)', marginTop: 10 }}>
            Before connecting, ensure your .pem file has the right permissions:
            <div style={{ background: '#0d1117', borderRadius: 4, padding: '6px 12px', fontFamily: 'monospace', fontSize: 12, color: '#8b949e', marginTop: 4 }}>
              chmod 400 "{keyName || 'my-key'}.pem"
            </div>
          </div>
        </div>
        <div className="aws-modal-footer">
          <button className="aws-btn aws-btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function InstanceDetail() {
  const { instanceId } = useParams();
  const navigate = useNavigate();
  const [instance, setInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  const load = async () => {
    setLoading(true);
    try {
      const all = await describeInstances();
      const inst = all.find(i => i.InstanceId === instanceId);
      if (!inst) { setError('Instance not found.'); return; }
      setInstance(inst);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [instanceId]);

  const doAction = async (action) => {
    setActionLoading(true);
    try {
      if (action === 'start')     await startInstances([instanceId]);
      if (action === 'stop')      await stopInstances([instanceId]);
      if (action === 'terminate') { await terminateInstances([instanceId]); navigate('/ec2'); return; }
      setTimeout(load, 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--aws-text-secondary)' }}>
      <span className="aws-spinner"/> Loading instance…
    </div>
  );

  const state = instance?.State?.Name;
  const name  = getInstanceName(instance);

  return (
    <div>
      {showConnect && instance && <ConnectModal instance={instance} onClose={() => setShowConnect(false)}/>}

      <div className="aws-breadcrumb">
        <Link to="/ec2" style={{ color: 'var(--aws-blue)' }}>Instances</Link>
        <span className="aws-breadcrumb-sep">›</span>
        <span style={{ fontWeight: 700 }}>{instanceId}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>
            {name !== '—' ? `${name} (${instanceId})` : instanceId}
          </h1>
          {instance && <StateBadge state={instance.State}/>}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="aws-btn-icon" onClick={load} disabled={loading} title="Refresh">
            <RefreshCw size={14}/>
          </button>
          <button className="aws-btn" disabled={!instance || actionLoading} onClick={() => setShowConnect(true)}>
            <Terminal size={13}/> Connect
          </button>
          <button className="aws-btn" disabled={state !== 'stopped' || actionLoading} onClick={() => doAction('start')}>
            Start instance
          </button>
          <button className="aws-btn" disabled={state !== 'running' || actionLoading} onClick={() => doAction('stop')}>
            Stop instance
          </button>
          <button
            className="aws-btn"
            disabled={!instance || state === 'terminated' || actionLoading}
            style={{ color: 'var(--aws-error)', borderColor: 'var(--aws-error)' }}
            onClick={() => { if (window.confirm(`Terminate ${instanceId}? This cannot be undone.`)) doAction('terminate'); }}
          >
            Terminate
          </button>
        </div>
      </div>

      {error && (
        <div className="aws-alert aws-alert-error" style={{ marginBottom: 16 }}>
          <X size={16} color="var(--aws-error)" style={{ flexShrink: 0 }}/>
          <span style={{ fontSize: 13 }}>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="aws-tabs" style={{ marginBottom: 0 }}>
        {['details', 'security', 'networking', 'storage'].map(tab => (
          <div
            key={tab}
            className={`aws-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
            style={{ textTransform: 'capitalize' }}
          >
            {tab}
          </div>
        ))}
      </div>

      <div className="aws-panel" style={{ borderTopLeftRadius: 0 }}>
        {activeTab === 'details' && instance && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, paddingTop: 4 }}>Instance summary</div>
              <DetailRow label="Instance ID"    value={instance.InstanceId}/>
              <DetailRow label="Instance state" value={<StateBadge state={instance.State}/>}/>
              <DetailRow label="Instance type"  value={instance.InstanceType}/>
              <DetailRow label="AMI ID"         value={instance.ImageId}/>
              <DetailRow label="Key pair name"  value={instance.KeyName}/>
              <DetailRow label="Launch time"    value={instance.LaunchTime ? new Date(instance.LaunchTime).toLocaleString() : '—'}/>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, paddingTop: 4 }}>Networking</div>
              <DetailRow label="Public IPv4"      value={instance.PublicIpAddress}/>
              <DetailRow label="Private IPv4"     value={instance.PrivateIpAddress}/>
              <DetailRow label="VPC ID"           value={instance.VpcId}/>
              <DetailRow label="Subnet ID"        value={instance.SubnetId}/>
              <DetailRow label="Availability Zone" value={instance.Placement?.AvailabilityZone}/>
            </div>
          </div>
        )}

        {activeTab === 'security' && instance && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Security groups</div>
            {(instance.SecurityGroups || []).length === 0 ? (
              <p style={{ color: 'var(--aws-text-secondary)', fontSize: 13 }}>No security groups attached.</p>
            ) : (
              <table className="aws-table">
                <thead>
                  <tr><th>Security group ID</th><th>Security group name</th></tr>
                </thead>
                <tbody>
                  {(instance.SecurityGroups || []).map(sg => (
                    <tr key={sg.GroupId}>
                      <td style={{ color: 'var(--aws-blue)' }}>{sg.GroupId}</td>
                      <td>{sg.GroupName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ fontWeight: 700, fontSize: 14, margin: '20px 0 8px' }}>Key pair</div>
            <DetailRow label="Key pair name" value={instance.KeyName}/>
          </div>
        )}

        {activeTab === 'networking' && instance && (
          <div>
            <DetailRow label="Public IPv4 address"  value={instance.PublicIpAddress}/>
            <DetailRow label="Private IPv4 address" value={instance.PrivateIpAddress}/>
            <DetailRow label="VPC ID"               value={instance.VpcId}/>
            <DetailRow label="Subnet ID"            value={instance.SubnetId}/>
            <DetailRow label="Availability Zone"    value={instance.Placement?.AvailabilityZone}/>
            <DetailRow label="Private DNS name"     value={instance.PrivateDnsName}/>
            <DetailRow label="Public DNS name"      value={instance.PublicDnsName}/>
          </div>
        )}

        {activeTab === 'storage' && (
          <p style={{ color: 'var(--aws-text-secondary)', fontSize: 13 }}>Storage details not available in local simulation.</p>
        )}
      </div>
    </div>
  );
}
