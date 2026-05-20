import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Info, Plus, X } from 'lucide-react';
import {
  runInstance, describeKeyPairs, describeSecurityGroups, createKeyPair,
  INSTANCE_TYPES, MOCK_AMIS,
} from '../../lib/ec2Client';

function Section({ title, children }) {
  return (
    <div className="aws-form-section">
      <div className="aws-form-section-header">{title}</div>
      <div className="aws-form-section-body">{children}</div>
    </div>
  );
}

export default function LaunchInstance() {
  const navigate = useNavigate();

  const [name, setName]               = useState('');
  const [selectedAmi, setSelectedAmi] = useState(MOCK_AMIS[0]);
  const [instanceType, setInstanceType] = useState('t2.micro');
  const [keyPairs, setKeyPairs]       = useState([]);
  const [keyName, setKeyName]         = useState('');
  const [securityGroups, setSecurityGroups] = useState([]);
  const [sgId, setSgId]               = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  // Create key pair inline
  const [showNewKey, setShowNewKey]   = useState(false);
  const [newKeyName, setNewKeyName]   = useState('');
  const [pemContent, setPemContent]   = useState('');
  const [creatingKey, setCreatingKey] = useState(false);

  useEffect(() => {
    describeKeyPairs().then(kps => {
      setKeyPairs(kps);
      if (kps.length > 0) setKeyName(kps[0].KeyName);
    }).catch(() => {});
    describeSecurityGroups().then(sgs => {
      setSecurityGroups(sgs);
      const def = sgs.find(sg => sg.GroupName === 'default') || sgs[0];
      if (def) setSgId(def.GroupId);
    }).catch(() => {});
  }, []);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const result = await createKeyPair(newKeyName.trim());
      setPemContent(result.KeyMaterial || '');
      setKeyPairs(prev => [...prev, { KeyName: newKeyName.trim(), KeyPairId: result.KeyPairId }]);
      setKeyName(newKeyName.trim());
      setShowNewKey(false);
      setNewKeyName('');
    } catch (err) {
      setError('Failed to create key pair: ' + err.message);
    } finally {
      setCreatingKey(false);
    }
  };

  const downloadPem = () => {
    if (!pemContent) return;
    const blob = new Blob([pemContent], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${keyName}.pem`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLaunch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const inst = await runInstance({
        imageId: selectedAmi.id,
        instanceType,
        keyName: keyName || undefined,
        securityGroupIds: sgId ? [sgId] : undefined,
        name: name.trim() || undefined,
      });
      navigate(`/ec2/instance/${inst.InstanceId}`);
    } catch (err) {
      setError(err.message || 'Failed to launch instance.');
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 80 }}>
      <div className="aws-breadcrumb">
        <Link to="/ec2" style={{ color: 'var(--aws-blue)' }}>EC2</Link>
        <span className="aws-breadcrumb-sep">›</span>
        <Link to="/ec2" style={{ color: 'var(--aws-blue)' }}>Instances</Link>
        <span className="aws-breadcrumb-sep">›</span>
        <span style={{ fontWeight: 700 }}>Launch an instance</span>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Launch an instance</h1>
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

      {/* PEM download banner */}
      {pemContent && (
        <div className="aws-alert" style={{ marginBottom: 16, background: '#d4edda', borderColor: '#c3e6cb' }}>
          <Info size={16} color="#155724" style={{ flexShrink: 0 }}/>
          <div style={{ flex: 1, fontSize: 13 }}>
            <strong>Key pair created.</strong> Download your private key file now — you won't be able to download it again.
          </div>
          <button className="aws-btn" style={{ background: '#155724', color: 'white', borderColor: '#155724' }} onClick={downloadPem}>
            Download {keyName}.pem
          </button>
        </div>
      )}

      <form onSubmit={handleLaunch}>

        {/* Name */}
        <Section title="Name and tags">
          <div className="aws-form-field">
            <label className="aws-form-label">Name <span style={{ fontWeight: 400, color: 'var(--aws-text-secondary)' }}>— optional</span></label>
            <input type="text" className="aws-input" placeholder="My EC2 Instance"
              value={name} onChange={e => setName(e.target.value)} style={{ maxWidth: 400 }}/>
          </div>
        </Section>

        {/* AMI */}
        <Section title={<>Application and OS Images (Amazon Machine Image) <span className="aws-info-link"><Info size={12} style={{ display: 'inline', verticalAlign: 'middle' }}/> Info</span></>}>
          <p style={{ fontSize: 13, color: 'var(--aws-text-secondary)', marginBottom: 14 }}>
            An AMI is a template that contains the software configuration needed to launch your instance.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MOCK_AMIS.map(ami => (
              <label key={ami.id}
                className={`aws-radio-card${selectedAmi.id === ami.id ? ' selected' : ''}`}
                onClick={() => setSelectedAmi(ami)}
                style={{ cursor: 'pointer' }}
              >
                <input type="radio" name="ami" checked={selectedAmi.id === ami.id} onChange={() => setSelectedAmi(ami)}/>
                <div className="aws-radio-card-content">
                  <h4 style={{ margin: 0 }}>{ami.name}</h4>
                  <p style={{ margin: 0 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{ami.id}</span>
                    <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--aws-text-secondary)' }}>Default user: <strong>{ami.user}</strong></span>
                  </p>
                </div>
              </label>
            ))}
          </div>
        </Section>

        {/* Instance type */}
        <Section title={<>Instance type <span className="aws-info-link"><Info size={12} style={{ display: 'inline', verticalAlign: 'middle' }}/> Info</span></>}>
          <p style={{ fontSize: 13, color: 'var(--aws-text-secondary)', marginBottom: 12 }}>
            The instance type defines the hardware configuration of your instance.
          </p>
          <div className="aws-form-field" style={{ marginBottom: 0 }}>
            <label className="aws-form-label">Instance type</label>
            <select className="aws-select" value={instanceType} onChange={e => setInstanceType(e.target.value)} style={{ maxWidth: 260 }}>
              {INSTANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </Section>

        {/* Key pair */}
        <Section title={<>Key pair (login) <span className="aws-info-link"><Info size={12} style={{ display: 'inline', verticalAlign: 'middle' }}/> Info</span></>}>
          <p style={{ fontSize: 13, color: 'var(--aws-text-secondary)', marginBottom: 12 }}>
            A key pair allows you to securely connect to your instance via SSH. Select an existing pair or create a new one.
          </p>
          <div className="aws-form-field">
            <label className="aws-form-label">Key pair name</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="aws-select" value={keyName} onChange={e => setKeyName(e.target.value)} style={{ maxWidth: 300 }}>
                <option value="">Proceed without a key pair</option>
                {keyPairs.map(kp => <option key={kp.KeyName} value={kp.KeyName}>{kp.KeyName}</option>)}
              </select>
              <button type="button" className="aws-btn" onClick={() => setShowNewKey(v => !v)}>
                <Plus size={13}/> Create new key pair
              </button>
            </div>
          </div>

          {showNewKey && (
            <div style={{ background: '#f7f9fa', border: '1px solid var(--aws-border-dark)', borderRadius: 4, padding: 14, marginTop: 4 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Create key pair</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text" className="aws-input" placeholder="my-key-pair"
                  value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                  style={{ maxWidth: 260 }}
                />
                <button type="button" className="aws-btn aws-btn-primary" onClick={handleCreateKey} disabled={creatingKey || !newKeyName.trim()}>
                  {creatingKey ? 'Creating…' : 'Create & download'}
                </button>
                <button type="button" className="aws-btn" onClick={() => setShowNewKey(false)}>Cancel</button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--aws-text-secondary)', marginTop: 8 }}>
                The private key (.pem) will be available for download immediately after creation.
              </p>
            </div>
          )}
        </Section>

        {/* Security Group */}
        <Section title={<>Network settings <span className="aws-info-link"><Info size={12} style={{ display: 'inline', verticalAlign: 'middle' }}/> Info</span></>}>
          <div className="aws-form-field" style={{ marginBottom: 0 }}>
            <label className="aws-form-label">Security group</label>
            <select className="aws-select" value={sgId} onChange={e => setSgId(e.target.value)} style={{ maxWidth: 320 }}>
              <option value="">No security group</option>
              {securityGroups.map(sg => (
                <option key={sg.GroupId} value={sg.GroupId}>{sg.GroupName} ({sg.GroupId})</option>
              ))}
            </select>
            <span className="aws-form-help">
              Manage security groups in <Link to="/ec2/security-groups" style={{ color: 'var(--aws-blue)' }}>Network & Security → Security Groups</Link>.
            </span>
          </div>
        </Section>

        {/* Footer */}
        <div className="aws-form-footer">
          <button type="button" className="aws-btn" onClick={() => navigate('/ec2')}>Cancel</button>
          <button type="submit" className="aws-btn aws-btn-primary" disabled={loading}>
            {loading
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="aws-spinner" style={{ width: 14, height: 14, borderWidth: 2 }}/> Launching…</span>
              : 'Launch instance'}
          </button>
        </div>
      </form>
    </div>
  );
}
