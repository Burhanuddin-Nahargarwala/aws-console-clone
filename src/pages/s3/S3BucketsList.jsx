import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ListBucketsCommand, DeleteBucketCommand,
  ListObjectsV2Command, DeleteObjectsCommand, GetBucketLocationCommand,
} from '@aws-sdk/client-s3';
import { Search, RefreshCw, Settings, ChevronUp, ChevronDown, ChevronsUpDown, X, Info, Copy } from 'lucide-react';
import { s3Client } from '../../aws-client';

const REGION_LABELS = {
  'ap-south-1':     'Asia Pacific (Mumbai)',
  'us-east-1':      'US East (N. Virginia)',
  'us-east-2':      'US East (Ohio)',
  'us-west-1':      'US West (N. California)',
  'us-west-2':      'US West (Oregon)',
  'ap-northeast-1': 'Asia Pacific (Tokyo)',
  'ap-southeast-1': 'Asia Pacific (Singapore)',
  'eu-west-1':      'Europe (Ireland)',
  'eu-central-1':   'Europe (Frankfurt)',
  'sa-east-1':      'South America (São Paulo)',
};

function formatRegion(code) {
  if (!code) return '—';
  const label = REGION_LABELS[code];
  return label ? `${label} ${code}` : code;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short',
  });
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronsUpDown size={11} style={{ opacity: 0.4, marginLeft: 3 }}/>;
  return sortDir === 'asc'
    ? <ChevronUp size={11} style={{ marginLeft: 3 }}/>
    : <ChevronDown size={11} style={{ marginLeft: 3 }}/>;
}

/* ── Toast ─────────────────────────────────────────────────────────── */
function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      background: '#232f3e', color: 'white', padding: '10px 18px',
      borderRadius: 6, fontSize: 13, fontWeight: 500,
      boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
    }}>
      {message}
    </div>
  );
}

/* ── Delete Bucket Modal ───────────────────────────────────────────── */
function DeleteBucketModal({ bucketName, onConfirm, onClose }) {
  const [input, setInput] = useState('');
  return (
    <div className="aws-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="aws-modal" style={{ maxWidth: 520 }}>
        <div className="aws-modal-header">
          <h2>Delete bucket</h2>
          <button className="aws-btn-link" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="aws-modal-body">
          <div className="aws-alert aws-alert-error" style={{ marginBottom: 16 }}>
            <X size={14} color="var(--aws-error)" style={{ flexShrink: 0 }}/>
            <span style={{ fontSize: 13 }}>
              Deleting a bucket is <strong>permanent and cannot be undone</strong>.
              The bucket must be empty before it can be deleted.
            </span>
          </div>
          <div className="aws-form-field">
            <label className="aws-form-label">
              To confirm deletion, type the bucket name: <strong>{bucketName}</strong>
            </label>
            <input type="text" className="aws-input" placeholder={bucketName}
              value={input} onChange={e => setInput(e.target.value)} autoFocus/>
          </div>
        </div>
        <div className="aws-modal-footer">
          <button className="aws-btn" onClick={onClose}>Cancel</button>
          <button
            className="aws-btn"
            style={{ background: 'var(--aws-error)', color: 'white', borderColor: 'var(--aws-error)' }}
            disabled={input !== bucketName}
            onClick={() => { onConfirm(); onClose(); }}
          >
            Delete bucket
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Empty Bucket Modal ────────────────────────────────────────────── */
function EmptyBucketModal({ bucketName, onConfirm, onClose }) {
  const [input, setInput] = useState('');
  const required = 'permanently delete';
  return (
    <div className="aws-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="aws-modal" style={{ maxWidth: 520 }}>
        <div className="aws-modal-header">
          <h2>Empty bucket</h2>
          <button className="aws-btn-link" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="aws-modal-body">
          <div className="aws-alert aws-alert-error" style={{ marginBottom: 16 }}>
            <X size={14} color="var(--aws-error)" style={{ flexShrink: 0 }}/>
            <span style={{ fontSize: 13 }}>
              This will <strong>permanently delete all objects</strong> in <strong>{bucketName}</strong>.
              This action cannot be undone.
            </span>
          </div>
          <div className="aws-form-field">
            <label className="aws-form-label">
              To confirm, type: <strong>{required}</strong>
            </label>
            <input type="text" className="aws-input" value={input}
              onChange={e => setInput(e.target.value)} autoFocus/>
          </div>
        </div>
        <div className="aws-modal-footer">
          <button className="aws-btn" onClick={onClose}>Cancel</button>
          <button
            className="aws-btn"
            style={{ background: 'var(--aws-error)', color: 'white', borderColor: 'var(--aws-error)' }}
            disabled={input !== required}
            onClick={() => { onConfirm(); onClose(); }}
          >
            Empty bucket
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Empty progress overlay ────────────────────────────────────────── */
function EmptyProgress({ bucketName, onDone, onError }) {
  const [deleted, setDeleted] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        let token;
        let total = 0;
        do {
          const list = await s3Client.send(new ListObjectsV2Command({
            Bucket: bucketName,
            ContinuationToken: token,
          }));
          const items = list.Contents || [];
          if (items.length > 0) {
            await s3Client.send(new DeleteObjectsCommand({
              Bucket: bucketName,
              Delete: { Objects: items.map(o => ({ Key: o.Key })), Quiet: true },
            }));
            total += items.length;
            if (!cancelled) setDeleted(total);
          }
          token = list.NextContinuationToken;
        } while (token);
        if (!cancelled) { setDone(true); onDone(); }
      } catch (err) {
        if (!cancelled) onError(err.message);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [bucketName, onDone, onError]);

  return (
    <div className="aws-modal-overlay">
      <div className="aws-modal" style={{ maxWidth: 400, textAlign: 'center' }}>
        <div className="aws-modal-body" style={{ padding: 32 }}>
          {done ? (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Bucket emptied</div>
              <div style={{ color: 'var(--aws-text-secondary)', fontSize: 13 }}>{deleted} objects deleted</div>
            </>
          ) : (
            <>
              <span className="aws-spinner" style={{ width: 36, height: 36, marginBottom: 16 }}/>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Emptying bucket…</div>
              <div style={{ color: 'var(--aws-text-secondary)', fontSize: 13 }}>{deleted} objects deleted so far</div>
            </>
          )}
        </div>
        {done && (
          <div className="aws-modal-footer" style={{ justifyContent: 'center' }}>
            <button className="aws-btn aws-btn-primary" onClick={onDone}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────── */
export default function S3BucketsList() {
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBucket, setSelectedBucket] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [showEmptyProgress, setShowEmptyProgress] = useState(false);
  const [toast, setToast] = useState('');

  const navigate = useNavigate();
  const showToast = msg => setToast(msg);

  const fetchBuckets = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelectedBucket(null);
    try {
      const data = await s3Client.send(new ListBucketsCommand({}));
      const bucketList = data.Buckets || [];
      // Fetch each bucket's actual region concurrently
      const withRegions = await Promise.all(
        bucketList.map(async b => {
          try {
            const loc = await s3Client.send(new GetBucketLocationCommand({ Bucket: b.Name }));
            return { ...b, Region: loc.LocationConstraint || 'us-east-1' };
          } catch {
            return { ...b, Region: null };
          }
        })
      );
      setBuckets(withRegions);
    } catch (err) {
      setError('Failed to load buckets. Make sure Floci is running on port 4566.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBuckets(); }, [fetchBuckets]);

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const filtered = buckets
    .filter(b => !searchQuery || b.Name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const va = sortCol === 'name' ? a.Name : new Date(a.CreationDate);
      const vb = sortCol === 'name' ? b.Name : new Date(b.CreationDate);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const handleCopyArn = async () => {
    if (!selectedBucket) return;
    try {
      await navigator.clipboard.writeText(`arn:aws:s3:::${selectedBucket}`);
      showToast('ARN copied');
    } catch {
      showToast('Copy failed');
    }
  };

  const handleDeleteBucket = async () => {
    try {
      await s3Client.send(new DeleteBucketCommand({ Bucket: selectedBucket }));
      showToast(`Bucket "${selectedBucket}" deleted`);
      setSelectedBucket(null);
      fetchBuckets();
    } catch (err) {
      if (err.name === 'BucketNotEmpty' || (err.message && err.message.includes('not empty'))) {
        setError(`Bucket "${selectedBucket}" is not empty. Empty the bucket first, then delete it.`);
      } else {
        setError('Failed to delete bucket: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const isSelected = !!selectedBucket;

  return (
    <div>
      {showDeleteModal && selectedBucket && (
        <DeleteBucketModal
          bucketName={selectedBucket}
          onConfirm={handleDeleteBucket}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
      {showEmptyModal && selectedBucket && (
        <EmptyBucketModal
          bucketName={selectedBucket}
          onConfirm={() => { setShowEmptyModal(false); setShowEmptyProgress(true); }}
          onClose={() => setShowEmptyModal(false)}
        />
      )}
      {showEmptyProgress && selectedBucket && (
        <EmptyProgress
          bucketName={selectedBucket}
          onDone={() => { setShowEmptyProgress(false); fetchBuckets(); showToast('Bucket emptied successfully'); }}
          onError={msg => { setShowEmptyProgress(false); setError('Empty failed: ' + msg); }}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast('')}/>}

      {/* Breadcrumb */}
      <div className="aws-breadcrumb">
        <span style={{ color: 'var(--aws-text-secondary)' }}>Amazon S3</span>
        <span className="aws-breadcrumb-sep">›</span>
        <span style={{ fontWeight: 700 }}>Buckets</span>
      </div>

      {/* Error banner */}
      {error && (
        <div className="aws-alert aws-alert-error">
          <X size={16} color="var(--aws-error)" style={{ flexShrink: 0 }}/>
          <div>
            <div className="aws-alert-title">Error</div>
            <div style={{ fontSize: 13 }}>{error}</div>
          </div>
          <button className="aws-btn-link" style={{ marginLeft: 'auto' }} onClick={() => setError('')}><X size={14}/></button>
        </div>
      )}

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>Buckets</h1>

      <div className="aws-tabs">
        <div className={`aws-tab${activeTab === 'general' ? ' active' : ''}`} onClick={() => setActiveTab('general')}>
          General purpose buckets{' '}
          <span className="aws-badge aws-badge-gray" style={{ marginLeft: 6, verticalAlign: 'middle' }}>All AWS Regions</span>
        </div>
        <div className={`aws-tab${activeTab === 'directory' ? ' active' : ''}`} onClick={() => setActiveTab('directory')}>
          Directory buckets
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* Main panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="aws-panel" style={{ padding: 0 }}>

            {/* Toolbar */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--aws-border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 700, marginRight: 4 }}>
                General purpose buckets
                <span style={{ fontWeight: 400, color: 'var(--aws-text-secondary)', fontSize: 14 }}> ({filtered.length})</span>
              </span>
              <span className="aws-info-link"><Info size={12} style={{ display: 'inline', verticalAlign: 'middle' }}/> Info</span>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className="aws-btn-icon" onClick={fetchBuckets} title="Refresh" disabled={loading}>
                  <RefreshCw size={14} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }}/>
                </button>
                <button className="aws-btn" disabled={!isSelected} onClick={handleCopyArn}>
                  <Copy size={13}/> Copy ARN
                </button>
                <button className="aws-btn" disabled={!isSelected} onClick={() => setShowEmptyModal(true)}>
                  Empty
                </button>
                <button className="aws-btn" disabled={!isSelected} onClick={() => setShowDeleteModal(true)}>
                  Delete
                </button>
                <button className="aws-btn aws-btn-primary" onClick={() => navigate('/s3/bucket/create')}>
                  Create bucket
                </button>
              </div>
            </div>

            {/* Description */}
            <div style={{ padding: '10px 16px', color: 'var(--aws-text-secondary)', fontSize: 13, borderBottom: '1px solid var(--aws-border)' }}>
              Buckets are containers for data stored in S3.
            </div>

            {/* Search */}
            <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--aws-border)' }}>
              <div style={{ flex: 1, position: 'relative', maxWidth: 420 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--aws-text-secondary)', pointerEvents: 'none' }}/>
                <input type="text" className="aws-input" placeholder="Find buckets by name"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 32 }}/>
              </div>
              <button className="aws-btn-icon" title="Column preferences"><Settings size={13}/></button>
            </div>

            {/* Table */}
            <table className="aws-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}/>
                  <th className="sortable" onClick={() => handleSort('name')} style={{ minWidth: 180 }}>
                    Name <SortIcon col="name" sortCol={sortCol} sortDir={sortDir}/>
                  </th>
                  <th className="sortable" onClick={() => handleSort('region')}>
                    AWS Region <SortIcon col="region" sortCol={sortCol} sortDir={sortDir}/>
                  </th>
                  <th>Access</th>
                  <th className="sortable" onClick={() => handleSort('date')}>
                    Creation date <SortIcon col="date" sortCol={sortCol} sortDir={sortDir}/>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 40 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--aws-text-secondary)' }}>
                        <span className="aws-spinner"/> Loading buckets…
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="aws-empty-state">
                        <div className="aws-empty-state-title">
                          {searchQuery ? `No buckets match "${searchQuery}"` : 'No buckets'}
                        </div>
                        <div className="aws-empty-state-desc">
                          {searchQuery
                            ? 'Clear the search filter to view all buckets.'
                            : 'Create your first bucket to get started with Amazon S3.'}
                        </div>
                        {!searchQuery && (
                          <button className="aws-btn aws-btn-primary" onClick={() => navigate('/s3/bucket/create')}>
                            Create bucket
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(bucket => (
                    <tr key={bucket.Name}
                      className={selectedBucket === bucket.Name ? 'selected' : ''}
                      onClick={() => setSelectedBucket(bucket.Name === selectedBucket ? null : bucket.Name)}
                      style={{ cursor: 'pointer' }}>
                      <td style={{ textAlign: 'center' }}>
                        <input type="radio" name="bucket-select"
                          checked={selectedBucket === bucket.Name}
                          onChange={() => setSelectedBucket(bucket.Name)}
                          onClick={e => e.stopPropagation()}
                          style={{ width: 14, height: 14 }}/>
                      </td>
                      <td>
                        <Link to={`/s3/bucket/${bucket.Name}`}
                          style={{ color: 'var(--aws-blue)', fontWeight: 600 }}
                          onClick={e => e.stopPropagation()}>
                          {bucket.Name}
                        </Link>
                      </td>
                      <td style={{ color: 'var(--aws-text-secondary)' }}>{formatRegion(bucket.Region)}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--aws-text-secondary)' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--aws-success)', display: 'inline-block', flexShrink: 0 }}/>
                          Bucket and objects not public
                        </span>
                      </td>
                      <td style={{ color: 'var(--aws-text-secondary)' }}>{formatDate(bucket.CreationDate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ width: 260, flexShrink: 0 }}>
          <div className="aws-widget" style={{ marginBottom: 16 }}>
            <div className="aws-widget-header" style={{ fontSize: 14 }}>
              ▶ Account snapshot
              <span className="aws-info-link" style={{ marginLeft: 4 }}><Info size={11} style={{ display: 'inline', verticalAlign: 'middle' }}/> Info</span>
            </div>
            <div className="aws-widget-content" style={{ padding: '12px 14px' }}>
              <div style={{ background: '#f0f7fb', borderRadius: 4, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 12 }}>
                <span style={{ background: '#0073bb', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>Updated daily</span>
              </div>
              <button className="aws-btn" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}>View dashboard</button>
              <p style={{ fontSize: 12, color: 'var(--aws-text-secondary)', lineHeight: 1.5 }}>
                Storage Lens provides visibility into storage usage and activity trends.
              </p>
            </div>
          </div>

          <div className="aws-widget">
            <div className="aws-widget-header" style={{ fontSize: 14 }}>
              ▶ External access summary
              <span className="aws-info-link" style={{ marginLeft: 4 }}><Info size={11} style={{ display: 'inline', verticalAlign: 'middle' }}/> Info</span>
            </div>
            <div className="aws-widget-content" style={{ padding: '12px 14px' }}>
              <div style={{ background: '#f0f7fb', borderRadius: 4, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 12 }}>
                <span style={{ background: '#0073bb', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>Updated daily</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--aws-text-secondary)', lineHeight: 1.5 }}>
                External access findings help you identify bucket permissions that allow public or cross-account access.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
