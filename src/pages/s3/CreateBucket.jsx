import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreateBucketCommand } from '@aws-sdk/client-s3';
import { Info, X, Plus, Trash2 } from 'lucide-react';
import { getS3Client } from '../../aws-client';
import { useRegion } from '../../lib/RegionContext';

const REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia) us-east-1' },
  { value: 'us-east-2', label: 'US East (Ohio) us-east-2' },
  { value: 'us-west-1', label: 'US West (N. California) us-west-1' },
  { value: 'us-west-2', label: 'US West (Oregon) us-west-2' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai) ap-south-1' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo) ap-northeast-1' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore) ap-southeast-1' },
  { value: 'eu-west-1', label: 'Europe (Ireland) eu-west-1' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt) eu-central-1' },
  { value: 'sa-east-1', label: 'South America (São Paulo) sa-east-1' },
];

function SectionHeader({ children, infoText }) {
  return (
    <div className="aws-form-section-header">
      {children}
      {infoText !== false && <span className="aws-info-link"><Info size={12} style={{ display:'inline', verticalAlign:'middle' }}/> Info</span>}
    </div>
  );
}

export default function CreateBucket() {
  const navigate = useNavigate();
  const { region: globalRegion } = useRegion();

  // ── General config ──────────────────────────────────────────────────────
  const [region, setRegion] = useState(globalRegion);
  const [bucketType, setBucketType] = useState('general');
  const [namespace, setNamespace] = useState('global');
  const [bucketName, setBucketName] = useState('');
  const [nameError, setNameError] = useState('');

  // ── Object Ownership ────────────────────────────────────────────────────
  const [objectOwnership, setObjectOwnership] = useState('bucket-owner-enforced');

  // ── Block Public Access ─────────────────────────────────────────────────
  const [blockAll, setBlockAll] = useState(true);
  const [blockAcl, setBlockAcl] = useState(true);
  const [blockAclIgnore, setBlockAclIgnore] = useState(true);
  const [blockPolicy, setBlockPolicy] = useState(true);
  const [blockPolicyIgnore, setBlockPolicyIgnore] = useState(true);

  // keep sub-checkboxes in sync with "Block all"
  const handleBlockAll = (v) => {
    setBlockAll(v);
    setBlockAcl(v); setBlockAclIgnore(v); setBlockPolicy(v); setBlockPolicyIgnore(v);
  };
  const handleSubCheck = (setter, value) => {
    setter(value);
    if (!value) setBlockAll(false);
    else if (blockAcl && blockAclIgnore && blockPolicy && blockPolicyIgnore) setBlockAll(true);
  };

  // ── Versioning ──────────────────────────────────────────────────────────
  const [versioning, setVersioning] = useState('disabled');

  // ── Tags ────────────────────────────────────────────────────────────────
  const [tags, setTags] = useState([]);
  const addTag = () => setTags(t => [...t, { key:'', value:'' }]);
  const removeTag = (i) => setTags(t => t.filter((_, j) => j !== i));
  const updateTag = (i, field, val) =>
    setTags(t => t.map((tag, j) => j === i ? { ...tag, [field]: val } : tag));

  // ── Default Encryption ──────────────────────────────────────────────────
  const [encryptionType, setEncryptionType] = useState('SSE-S3');
  const [bucketKey, setBucketKey] = useState('enabled');

  // ── Object Lock ─────────────────────────────────────────────────────────
  const [objectLock, setObjectLock] = useState(false);

  // ── Submit ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateName = (name) => {
    if (!name) return 'Bucket name is required.';
    if (name.length < 3 || name.length > 63) return 'Bucket name must be between 3 and 63 characters.';
    if (!/^[a-z0-9][a-z0-9.\-]*[a-z0-9]$/.test(name)) return 'Bucket name must start and end with a letter or number. Valid characters: a–z, 0–9, hyphens, periods.';
    if (/\.\./.test(name)) return 'Bucket name must not contain consecutive periods.';
    if (/\d+\.\d+\.\d+\.\d+/.test(name)) return 'Bucket name must not be formatted as an IP address.';
    return '';
  };

  const handleNameChange = (e) => {
    const v = e.target.value.toLowerCase();
    setBucketName(v);
    setNameError(v ? validateName(v) : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validateName(bucketName);
    if (err) { setNameError(err); return; }

    setLoading(true);
    setError('');
    try {
      const params = { Bucket: bucketName };
      if (region !== 'us-east-1') {
        params.CreateBucketConfiguration = { LocationConstraint: region };
      }
      await getS3Client(region).send(new CreateBucketCommand(params));
      navigate('/s3');
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred while creating the bucket.');
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth:'860px', margin:'0 auto', paddingBottom:'80px' }}>

      {/* Breadcrumb */}
      <div className="aws-breadcrumb">
        <Link to="/s3" style={{ color:'var(--aws-blue)' }}>Amazon S3</Link>
        <span className="aws-breadcrumb-sep">›</span>
        <Link to="/s3" style={{ color:'var(--aws-blue)' }}>Buckets</Link>
        <span className="aws-breadcrumb-sep">›</span>
        <span style={{ fontWeight:'700' }}>Create bucket</span>
      </div>

      {/* Page title */}
      <div style={{ marginBottom:'20px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
          Create bucket
          <span className="aws-info-link"><Info size={12} style={{ display:'inline', verticalAlign:'middle' }}/> Info</span>
        </h1>
        <p style={{ color:'var(--aws-text-secondary)', fontSize:'13px' }}>
          Buckets are containers for data stored in S3.{' '}
          <a href="#">Learn more about Amazon S3</a>
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="aws-alert aws-alert-error" style={{ marginBottom:'20px' }}>
          <X size={16} color="var(--aws-error)" style={{ flexShrink:0, marginTop:'1px' }}/>
          <div>
            <div className="aws-alert-title">Error creating bucket</div>
            <div style={{ fontSize:'13px' }}>{error}</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* ── General Configuration ─────────────────────────────────── */}
        <div className="aws-form-section">
          <SectionHeader infoText={false}>General configuration</SectionHeader>
          <div className="aws-form-section-body">

            {/* AWS Region */}
            <div className="aws-form-field">
              <label className="aws-form-label">AWS Region</label>
              <select className="aws-select" value={region} onChange={e => setRegion(e.target.value)}>
                {REGIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <span className="aws-form-help">Choose the AWS Region where you want the bucket to reside.</span>
            </div>

            {/* Bucket type */}
            <div className="aws-form-field">
              <label className="aws-form-label">
                Bucket type <span className="aws-info-link"><Info size={12} style={{ display:'inline', verticalAlign:'middle' }}/> Info</span>
              </label>
              <div className="aws-radio-card-group">
                <label className={`aws-radio-card${bucketType === 'general' ? ' selected' : ''}`} onClick={() => setBucketType('general')}>
                  <input type="radio" name="bucket-type" checked={bucketType === 'general'} onChange={() => setBucketType('general')}/>
                  <div className="aws-radio-card-content">
                    <h4>General purpose</h4>
                    <p>Recommended for most use cases and access patterns. General purpose buckets are the original S3 bucket type. They allow a mix of storage classes that redundantly store objects across multiple Availability Zones.</p>
                  </div>
                </label>
                <label className={`aws-radio-card${bucketType === 'directory' ? ' selected' : ''}`} onClick={() => setBucketType('directory')}>
                  <input type="radio" name="bucket-type" checked={bucketType === 'directory'} onChange={() => setBucketType('directory')}/>
                  <div className="aws-radio-card-content">
                    <h4>Directory</h4>
                    <p>Recommended for low-latency use cases. These buckets use only the S3 Express One Zone storage class, which provides faster processing of data within a single Availability Zone.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Bucket namespace */}
            <div className="aws-form-field">
              <label className="aws-form-label">Bucket namespace</label>
              <span className="aws-form-help">Choose the namespace where you want to create your bucket. <a href="#">Learn more</a></span>
              <div style={{ marginTop:'10px', display:'flex', flexDirection:'column', gap:'10px' }}>
                <label className="aws-checkbox-row" style={{ cursor:'pointer' }}>
                  <input type="radio" name="namespace" checked={namespace === 'global'} onChange={() => setNamespace('global')}/>
                  <div className="aws-checkbox-row-text">
                    <strong>Global namespace</strong>
                    <span>By default, S3 creates general purpose buckets in the global namespace. Bucket names must be globally unique across all AWS accounts and regions.</span>
                  </div>
                </label>
                <label className="aws-checkbox-row" style={{ cursor:'pointer' }}>
                  <input type="radio" name="namespace" checked={namespace === 'regional'} onChange={() => setNamespace('regional')}/>
                  <div className="aws-checkbox-row-text">
                    <strong>Account Regional namespace <span style={{ color:'var(--aws-success)', fontWeight:'400' }}>(recommended)</span></strong>
                    <span>General purpose buckets created in your account Regional namespace are unique to your account and the selected AWS Region.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Bucket name */}
            <div className="aws-form-field" style={{ marginBottom:0 }}>
              <label className="aws-form-label">
                Bucket name <span className="aws-info-link"><Info size={12} style={{ display:'inline', verticalAlign:'middle' }}/> Info</span>
              </label>
              <input
                type="text"
                className="aws-input"
                value={bucketName}
                onChange={handleNameChange}
                placeholder="amzn-s3-demo-bucket"
                style={{ borderColor: nameError ? 'var(--aws-error)' : undefined }}
                required
              />
              {nameError
                ? <span style={{ color:'var(--aws-error)', fontSize:'12px', marginTop:'4px', display:'block' }}>{nameError}</span>
                : <span className="aws-form-help">Bucket names must be 3–63 characters long, start and end with a letter or number, and can include hyphens and periods. Must be unique in the selected namespace. <a href="#">Learn more</a></span>
              }
              {bucketName && !nameError && (
                <div style={{ marginTop:'8px', padding:'8px 12px', background:'#f7f9fa', borderRadius:'2px', border:'1px solid var(--aws-border-dark)', fontSize:'13px' }}>
                  <span style={{ color:'var(--aws-text-secondary)' }}>S3 URI: </span>
                  <strong>s3://{bucketName}</strong>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Object Ownership ──────────────────────────────────────── */}
        <div className="aws-form-section">
          <SectionHeader>Object Ownership</SectionHeader>
          <div className="aws-form-section-body">
            <p style={{ fontSize:'13px', color:'var(--aws-text-secondary)', marginBottom:'16px' }}>
              Control ownership of objects written to this bucket from other AWS accounts and the use of access control lists (ACLs).
              Object ownership determines who can specify access to objects.
            </p>
            <label className="aws-form-label">Object Ownership</label>
            <div className="aws-radio-card-group">
              <label className={`aws-radio-card${objectOwnership === 'bucket-owner-enforced' ? ' selected' : ''}`}
                onClick={() => setObjectOwnership('bucket-owner-enforced')}>
                <input type="radio" name="object-ownership" checked={objectOwnership === 'bucket-owner-enforced'} onChange={() => setObjectOwnership('bucket-owner-enforced')}/>
                <div className="aws-radio-card-content">
                  <h4>ACLs disabled <span style={{ color:'var(--aws-success)', fontWeight:'400' }}>(recommended)</span></h4>
                  <p>All objects in this bucket are owned by this account. Access to this bucket and its objects is specified using only policies.</p>
                </div>
              </label>
              <label className={`aws-radio-card${objectOwnership === 'acl-enabled' ? ' selected' : ''}`}
                onClick={() => setObjectOwnership('acl-enabled')}>
                <input type="radio" name="object-ownership" checked={objectOwnership === 'acl-enabled'} onChange={() => setObjectOwnership('acl-enabled')}/>
                <div className="aws-radio-card-content">
                  <h4>ACLs enabled</h4>
                  <p>Objects in this bucket can be owned by other AWS accounts. Access to this bucket and its objects can be specified using ACLs.</p>
                </div>
              </label>
            </div>
            {objectOwnership === 'bucket-owner-enforced' && (
              <div style={{ marginTop:'12px', fontSize:'13px' }}>
                <span style={{ fontWeight:'700' }}>Object Ownership: </span>Bucket owner enforced
              </div>
            )}
          </div>
        </div>

        {/* ── Block Public Access ───────────────────────────────────── */}
        <div className="aws-form-section">
          <SectionHeader infoText={false}>Block Public Access settings for this bucket</SectionHeader>
          <div className="aws-form-section-body">
            <p style={{ fontSize:'13px', color:'var(--aws-text-secondary)', marginBottom:'16px' }}>
              Public access is granted to buckets and objects through access control lists (ACLs), bucket policies, access point policies, or all.
              In order to ensure that public access to this bucket and its objects is blocked, turn on Block all public access.
              These settings apply only to this bucket and its access points. <a href="#">Learn more</a>
            </p>

            <div style={{ backgroundColor:'#fafafa', border:'1px solid var(--aws-border-dark)', padding:'14px 16px', borderRadius:'4px' }}>
              <label className="aws-checkbox-row" style={{ cursor:'pointer', marginBottom:'0' }}>
                <input type="checkbox" checked={blockAll} onChange={e => handleBlockAll(e.target.checked)}/>
                <div className="aws-checkbox-row-text">
                  <strong>Block all public access</strong>
                  <span>Turning this setting on is the same as turning on all four settings below. Each of the following settings are independent of one another.</span>
                </div>
              </label>

              <div className="aws-sub-checkboxes">
                <label className="aws-checkbox-row" style={{ cursor:'pointer' }}>
                  <input type="checkbox" checked={blockAcl} onChange={e => handleSubCheck(setBlockAcl, e.target.checked)}/>
                  <div className="aws-checkbox-row-text">
                    <strong>Block public access to buckets and objects granted through new access control lists (ACLs)</strong>
                    <span>S3 will block public access permissions applied to newly added buckets or objects, and prevent the creation of new public access ACLs for existing buckets and objects.</span>
                  </div>
                </label>
                <label className="aws-checkbox-row" style={{ cursor:'pointer' }}>
                  <input type="checkbox" checked={blockAclIgnore} onChange={e => handleSubCheck(setBlockAclIgnore, e.target.checked)}/>
                  <div className="aws-checkbox-row-text">
                    <strong>Block public access to buckets and objects granted through any access control lists (ACLs)</strong>
                    <span>S3 will ignore all ACLs that grant public access to buckets and objects.</span>
                  </div>
                </label>
                <label className="aws-checkbox-row" style={{ cursor:'pointer' }}>
                  <input type="checkbox" checked={blockPolicy} onChange={e => handleSubCheck(setBlockPolicy, e.target.checked)}/>
                  <div className="aws-checkbox-row-text">
                    <strong>Block public access to buckets and objects granted through new public bucket or access point policies</strong>
                    <span>S3 will block new bucket and access-point policies that grant public access to buckets and objects.</span>
                  </div>
                </label>
                <label className="aws-checkbox-row" style={{ cursor:'pointer' }}>
                  <input type="checkbox" checked={blockPolicyIgnore} onChange={e => handleSubCheck(setBlockPolicyIgnore, e.target.checked)}/>
                  <div className="aws-checkbox-row-text">
                    <strong>Block public and cross-account access to buckets and objects through any public bucket or access point policies</strong>
                    <span>S3 will ignore public and cross-account access for buckets or access points with policies that grant public access.</span>
                  </div>
                </label>
              </div>
            </div>

            {!blockAll && (
              <div className="aws-alert aws-alert-warning" style={{ marginTop:'12px' }}>
                <div>
                  <div className="aws-alert-title">Turning off block all public access might result in this bucket and the objects within becoming public.</div>
                  <div style={{ fontSize:'13px' }}>We recommend that you keep all settings enabled unless your use case requires public access.</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Bucket Versioning ─────────────────────────────────────── */}
        <div className="aws-form-section">
          <SectionHeader infoText={false}>Bucket Versioning</SectionHeader>
          <div className="aws-form-section-body">
            <p style={{ fontSize:'13px', color:'var(--aws-text-secondary)', marginBottom:'16px' }}>
              Versioning is a means of keeping multiple variants of an object in the same bucket.
              You can use versioning to preserve, retrieve, and restore every version of every object stored in your Amazon S3 bucket.
              With versioning, you can recover from both unintended user actions and application failures. <a href="#">Learn more</a>
            </p>
            <label className="aws-form-label">Bucket Versioning</label>
            <div style={{ display:'flex', gap:'24px', marginTop:'8px' }}>
              <label className="aws-checkbox-row" style={{ cursor:'pointer', gap:'8px' }}>
                <input type="radio" name="versioning" checked={versioning === 'disabled'} onChange={() => setVersioning('disabled')}/>
                <span>Disable</span>
              </label>
              <label className="aws-checkbox-row" style={{ cursor:'pointer', gap:'8px' }}>
                <input type="radio" name="versioning" checked={versioning === 'enabled'} onChange={() => setVersioning('enabled')}/>
                <span>Enable</span>
              </label>
            </div>
          </div>
        </div>

        {/* ── Tags ──────────────────────────────────────────────────── */}
        <div className="aws-form-section">
          <SectionHeader infoText={false}>Tags <span style={{ fontWeight:'400', fontSize:'14px', color:'var(--aws-text-secondary)' }}>— optional</span></SectionHeader>
          <div className="aws-form-section-body">
            <p style={{ fontSize:'13px', color:'var(--aws-text-secondary)', marginBottom:'16px' }}>
              You can use tags to track costs and manage access to buckets.
              Each tag is a key-value pair. You can add up to 10 tags. <a href="#">Learn more</a>
            </p>
            {tags.length > 0 && (
              <table className="aws-tags-table" style={{ marginBottom:'12px' }}>
                <thead>
                  <tr>
                    <th style={{ width:'45%' }}>Key</th>
                    <th style={{ width:'45%' }}>Value <span style={{ fontWeight:'400', color:'var(--aws-text-secondary)' }}>— optional</span></th>
                    <th style={{ width:'10%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((tag, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          type="text" placeholder="Key" value={tag.key}
                          onChange={e => updateTag(i, 'key', e.target.value)}
                          maxLength={128}
                        />
                      </td>
                      <td>
                        <input
                          type="text" placeholder="Value" value={tag.value}
                          onChange={e => updateTag(i, 'value', e.target.value)}
                          maxLength={256}
                        />
                      </td>
                      <td>
                        <button type="button" className="aws-btn-link" onClick={() => removeTag(i)} style={{ color:'var(--aws-error)' }}>
                          <Trash2 size={14}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tags.length < 10 && (
              <button type="button" className="aws-btn" onClick={addTag} style={{ fontSize:'13px' }}>
                <Plus size={14}/> Add tag
              </button>
            )}
          </div>
        </div>

        {/* ── Default Encryption ───────────────────────────────────── */}
        <div className="aws-form-section">
          <SectionHeader>Default encryption</SectionHeader>
          <div className="aws-form-section-body">
            <p style={{ fontSize:'13px', color:'var(--aws-text-secondary)', marginBottom:'16px' }}>
              Server-side encryption is automatically applied to new objects stored in this bucket.
            </p>

            <div className="aws-form-field">
              <label className="aws-form-label">
                Encryption type <span className="aws-info-link"><Info size={12} style={{ display:'inline', verticalAlign:'middle' }}/> Info</span>
              </label>
              <span className="aws-form-help">Secure your objects with encryption managed by Amazon S3 or AWS KMS.</span>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginTop:'10px' }}>
                <label className="aws-checkbox-row" style={{ cursor:'pointer', gap:'8px' }}>
                  <input type="radio" name="encryption" checked={encryptionType === 'SSE-S3'} onChange={() => setEncryptionType('SSE-S3')}/>
                  <div>
                    <div style={{ fontWeight:'700', fontSize:'13px' }}>Server-side encryption with Amazon S3 managed keys (SSE-S3)</div>
                    <div style={{ fontSize:'12px', color:'var(--aws-text-secondary)' }}>Uses AES-256 encryption. No additional charges.</div>
                  </div>
                </label>
                <label className="aws-checkbox-row" style={{ cursor:'pointer', gap:'8px' }}>
                  <input type="radio" name="encryption" checked={encryptionType === 'SSE-KMS'} onChange={() => setEncryptionType('SSE-KMS')}/>
                  <div>
                    <div style={{ fontWeight:'700', fontSize:'13px' }}>Server-side encryption with AWS Key Management Service keys (SSE-KMS)</div>
                    <div style={{ fontSize:'12px', color:'var(--aws-text-secondary)' }}>Uses keys managed in AWS KMS. Additional charges apply.</div>
                  </div>
                </label>
                <label className="aws-checkbox-row" style={{ cursor:'pointer', gap:'8px' }}>
                  <input type="radio" name="encryption" checked={encryptionType === 'DSSE-KMS'} onChange={() => setEncryptionType('DSSE-KMS')}/>
                  <div>
                    <div style={{ fontWeight:'700', fontSize:'13px' }}>Dual-layer server-side encryption with AWS KMS keys (DSSE-KMS)</div>
                    <div style={{ fontSize:'12px', color:'var(--aws-text-secondary)' }}>Two separate layers of encryption. Additional charges apply.</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="aws-form-field" style={{ marginBottom:0 }}>
              <label className="aws-form-label">
                Bucket Key <span className="aws-info-link"><Info size={12} style={{ display:'inline', verticalAlign:'middle' }}/> Info</span>
              </label>
              <span className="aws-form-help">Using an S3 Bucket Key for SSE-KMS reduces encryption costs by lowering calls to AWS KMS. S3 Bucket Keys aren't supported for DSSE-KMS. <a href="#">Learn more</a></span>
              <div style={{ display:'flex', gap:'24px', marginTop:'10px' }}>
                <label className="aws-checkbox-row" style={{ cursor:'pointer', gap:'8px' }}>
                  <input type="radio" name="bucket-key" checked={bucketKey === 'disabled'} onChange={() => setBucketKey('disabled')}/>
                  <span>Disable</span>
                </label>
                <label className="aws-checkbox-row" style={{ cursor:'pointer', gap:'8px' }}>
                  <input type="radio" name="bucket-key" checked={bucketKey === 'enabled'} onChange={() => setBucketKey('enabled')}/>
                  <span>Enable</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ── Object Lock ───────────────────────────────────────────── */}
        <div className="aws-form-section">
          <SectionHeader infoText={false}>Object Lock</SectionHeader>
          <div className="aws-form-section-body">
            <p style={{ fontSize:'13px', color:'var(--aws-text-secondary)', marginBottom:'16px' }}>
              With S3 Object Lock, you can store objects using a write-once-read-many (WORM) model.
              Object Lock can help prevent objects from being deleted or overwritten for a fixed amount of time or indefinitely.
              You can enable Object Lock for this bucket only when you create it — you cannot enable it later.
              Enabling Object Lock also enables versioning for this bucket. <a href="#">Learn more</a>
            </p>

            <div style={{ backgroundColor:'#fafafa', border:'1px solid var(--aws-border-dark)', padding:'14px 16px', borderRadius:'4px' }}>
              <label className="aws-checkbox-row" style={{ cursor:'pointer' }}>
                <input type="checkbox" checked={objectLock} onChange={e => setObjectLock(e.target.checked)}/>
                <div className="aws-checkbox-row-text">
                  <strong>Enable</strong>
                  <span>Enable S3 Object Lock for this bucket. This also enables versioning for this bucket.</span>
                </div>
              </label>
            </div>

            {objectLock && (
              <div className="aws-alert aws-alert-warning" style={{ marginTop:'12px' }}>
                <div>
                  <div className="aws-alert-title">Object Lock is enabled</div>
                  <div style={{ fontSize:'13px' }}>
                    Enabling Object Lock will also enable versioning for this bucket. You will not be able to disable Object Lock or suspend versioning after the bucket is created.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Fixed footer ──────────────────────────────────────────── */}
        <div className="aws-form-footer">
          <button type="button" className="aws-btn" onClick={() => navigate('/s3')}>Cancel</button>
          <button type="submit" className="aws-btn aws-btn-primary" disabled={loading || !!nameError || !bucketName}>
            {loading ? (
              <span style={{ display:'inline-flex', alignItems:'center', gap:'8px' }}>
                <span className="aws-spinner" style={{ width:'14px', height:'14px', borderWidth:'2px' }}/>
                Creating…
              </span>
            ) : 'Create bucket'}
          </button>
        </div>
      </form>
    </div>
  );
}
