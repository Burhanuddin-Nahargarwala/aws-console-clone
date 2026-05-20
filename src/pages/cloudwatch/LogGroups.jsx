import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Search, X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { describeLogGroups } from '../../lib/cloudwatchClient';
import { useRegion } from '../../lib/RegionContext';

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronsUpDown size={11} style={{ opacity: 0.4, marginLeft: 3 }}/>;
  return sortDir === 'asc'
    ? <ChevronUp size={11} style={{ marginLeft: 3 }}/>
    : <ChevronDown size={11} style={{ marginLeft: 3 }}/>;
}

export default function LogGroups() {
  const navigate = useNavigate();
  const { region } = useRegion();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await describeLogGroups();
      setGroups(data);
    } catch (err) {
      setError('Could not connect to CloudWatch. Make sure Floci is running on port 4566.');
    } finally {
      setLoading(false);
    }
  }, [region]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const filtered = groups
    .filter(g => !search || g.logGroupName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let va, vb;
      if (sortCol === 'name') { va = a.logGroupName; vb = b.logGroupName; }
      else if (sortCol === 'size') { va = a.storedBytes || 0; vb = b.storedBytes || 0; }
      else { va = a.creationTime || 0; vb = b.creationTime || 0; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const openStreams = (groupName) => {
    navigate(`/cloudwatch/logs/streams?group=${encodeURIComponent(groupName)}`);
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="aws-breadcrumb">
        <span style={{ color: 'var(--aws-text-secondary)' }}>CloudWatch</span>
        <span className="aws-breadcrumb-sep">›</span>
        <span style={{ color: 'var(--aws-text-secondary)' }}>Logs</span>
        <span className="aws-breadcrumb-sep">›</span>
        <span style={{ fontWeight: 700 }}>Log groups</span>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Log groups</h1>
      <p style={{ color: 'var(--aws-text-secondary)', fontSize: 13, marginBottom: 20 }}>
        A log group is a group of log streams that share the same retention, monitoring, and access control settings.
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
            Log groups
            <span style={{ fontWeight: 400, color: 'var(--aws-text-secondary)', fontSize: 13 }}> ({filtered.length})</span>
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--aws-text-secondary)', pointerEvents: 'none' }}/>
              <input
                type="text"
                className="aws-input"
                placeholder="Filter log groups"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 30, width: 240 }}
              />
            </div>
            <button className="aws-btn-icon" onClick={load} disabled={loading} title="Refresh">
              <RefreshCw size={14} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }}/>
            </button>
          </div>
        </div>

        {/* Table */}
        <table className="aws-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('name')}>
                Log group name <SortIcon col="name" sortCol={sortCol} sortDir={sortDir}/>
              </th>
              <th>Subscriptions</th>
              <th>Metric filters</th>
              <th>Retention</th>
              <th className="sortable" onClick={() => handleSort('size')}>
                Size <SortIcon col="size" sortCol={sortCol} sortDir={sortDir}/>
              </th>
              <th className="sortable" onClick={() => handleSort('created')}>
                Created <SortIcon col="created" sortCol={sortCol} sortDir={sortDir}/>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--aws-text-secondary)' }}>
                    <span className="aws-spinner"/> Loading log groups…
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="aws-empty-state">
                    <div className="aws-empty-state-title">
                      {search ? `No log groups match "${search}"` : 'No log groups'}
                    </div>
                    <div className="aws-empty-state-desc">
                      {search
                        ? 'Try a different search term.'
                        : 'Log groups are created automatically when a Lambda function is invoked for the first time. Invoke a Lambda function to see its log group here.'}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map(g => (
                <tr key={g.logGroupName} style={{ cursor: 'pointer' }} onClick={() => openStreams(g.logGroupName)}>
                  <td>
                    <span
                      style={{ color: 'var(--aws-blue)', fontWeight: 500, cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); openStreams(g.logGroupName); }}
                    >
                      {g.logGroupName}
                    </span>
                  </td>
                  <td style={{ color: 'var(--aws-text-secondary)' }}>0</td>
                  <td style={{ color: 'var(--aws-text-secondary)' }}>{g.metricFilterCount || 0}</td>
                  <td style={{ color: 'var(--aws-text-secondary)' }}>
                    {g.retentionInDays ? `${g.retentionInDays} days` : 'Never expire'}
                  </td>
                  <td style={{ color: 'var(--aws-text-secondary)' }}>{formatBytes(g.storedBytes)}</td>
                  <td style={{ color: 'var(--aws-text-secondary)' }}>{formatDate(g.creationTime)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
