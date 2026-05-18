import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ListBucketsCommand } from '@aws-sdk/client-s3';
import { Search, RefreshCw, Settings, ChevronUp, ChevronDown, ChevronsUpDown, X, Info } from 'lucide-react';
import { s3Client } from '../../aws-client';

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

export default function S3BucketsList() {
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBucket, setSelectedBucket] = useState(null); // radio — single selection
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const navigate = useNavigate();

  const fetchBuckets = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelectedBucket(null);
    try {
      const data = await s3Client.send(new ListBucketsCommand({}));
      setBuckets(data.Buckets || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load buckets. Make sure Floci is running on port 4566.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBuckets(); }, [fetchBuckets]);

  const handleSort = (col) => {
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

  const isSelected = !!selectedBucket;

  return (
    <div>
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
            <div className="aws-alert-title">Error loading buckets</div>
            <div style={{ fontSize: 13 }}>{error}</div>
          </div>
        </div>
      )}

      {/* Title + tabs */}
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>Buckets</h1>

      <div className="aws-tabs">
        <div
          className={`aws-tab${activeTab === 'general' ? ' active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General purpose buckets{' '}
          <span className="aws-badge aws-badge-gray" style={{ marginLeft: 6, verticalAlign: 'middle' }}>All AWS Regions</span>
        </div>
        <div
          className={`aws-tab${activeTab === 'directory' ? ' active' : ''}`}
          onClick={() => setActiveTab('directory')}
        >
          Directory buckets
        </div>
      </div>

      {/* Two-column layout: main + right sidebar */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* ── Main Panel ─────────────────────────────────────────────── */}
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
                <button className="aws-btn" disabled={!isSelected}>Copy ARN</button>
                <button className="aws-btn" disabled={!isSelected}>Empty</button>
                <button className="aws-btn" disabled={!isSelected}>Delete</button>
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
                <input
                  type="text"
                  className="aws-input"
                  placeholder="Find buckets by name"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 32 }}
                />
              </div>
              <button className="aws-btn-icon" title="Column preferences"><Settings size={13}/></button>
            </div>

            {/* Table */}
            <table className="aws-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
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
                    <tr
                      key={bucket.Name}
                      className={selectedBucket === bucket.Name ? 'selected' : ''}
                      onClick={() => setSelectedBucket(bucket.Name === selectedBucket ? null : bucket.Name)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="radio"
                          name="bucket-select"
                          checked={selectedBucket === bucket.Name}
                          onChange={() => setSelectedBucket(bucket.Name)}
                          onClick={e => e.stopPropagation()}
                          style={{ width: 14, height: 14 }}
                        />
                      </td>
                      <td>
                        <Link
                          to={`/s3/bucket/${bucket.Name}`}
                          style={{ color: 'var(--aws-blue)', fontWeight: 600 }}
                          onClick={e => e.stopPropagation()}
                        >
                          {bucket.Name}
                        </Link>
                      </td>
                      <td style={{ color: 'var(--aws-text-secondary)' }}>Asia Pacific (Mumbai) ap-south-1</td>
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

        {/* ── Right sidebar panels ────────────────────────────────────── */}
        <div style={{ width: 260, flexShrink: 0 }}>

          {/* Account snapshot */}
          <div className="aws-widget" style={{ marginBottom: 16 }}>
            <div className="aws-widget-header" style={{ fontSize: 14 }}>
              ▶ Account snapshot
              <span className="aws-info-link" style={{ marginLeft: 4 }}><Info size={11} style={{ display: 'inline', verticalAlign: 'middle' }}/> Info</span>
            </div>
            <div className="aws-widget-content" style={{ padding: '12px 14px' }}>
              <div style={{ background: '#f0f7fb', borderRadius: 4, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 12 }}>
                <span style={{ background: '#0073bb', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>Updated daily</span>
              </div>
              <button className="aws-btn" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}>
                View dashboard
              </button>
              <p style={{ fontSize: 12, color: 'var(--aws-text-secondary)', lineHeight: 1.5 }}>
                Storage Lens provides visibility into storage usage and activity trends.
              </p>
            </div>
          </div>

          {/* External access summary */}
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
