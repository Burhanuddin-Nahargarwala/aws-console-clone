import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { RefreshCw, X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { describeLogStreams } from '../../lib/cloudwatchClient';

function formatDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronsUpDown size={11} style={{ opacity: 0.4, marginLeft: 3 }}/>;
  return sortDir === 'asc'
    ? <ChevronUp size={11} style={{ marginLeft: 3 }}/>
    : <ChevronDown size={11} style={{ marginLeft: 3 }}/>;
}

export default function LogStreams() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupName = searchParams.get('group') || '';

  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortCol, setSortCol] = useState('lastEvent');
  const [sortDir, setSortDir] = useState('desc');

  const load = useCallback(async () => {
    if (!groupName) return;
    setLoading(true);
    setError('');
    try {
      const data = await describeLogStreams(groupName);
      setStreams(data);
    } catch (err) {
      setError(`Failed to load log streams: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [groupName]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sorted = [...streams].sort((a, b) => {
    let va, vb;
    if (sortCol === 'name') { va = a.logStreamName; vb = b.logStreamName; }
    else if (sortCol === 'lastEvent') { va = a.lastEventTimestamp || 0; vb = b.lastEventTimestamp || 0; }
    else { va = a.creationTime || 0; vb = b.creationTime || 0; }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const openEvents = (streamName) => {
    navigate(`/cloudwatch/logs/events?group=${encodeURIComponent(groupName)}&stream=${encodeURIComponent(streamName)}`);
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="aws-breadcrumb">
        <span style={{ color: 'var(--aws-text-secondary)' }}>CloudWatch</span>
        <span className="aws-breadcrumb-sep">›</span>
        <Link to="/cloudwatch/logs" style={{ color: 'var(--aws-blue)' }}>Log groups</Link>
        <span className="aws-breadcrumb-sep">›</span>
        <span style={{ fontWeight: 700 }}>{groupName}</span>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{groupName}</h1>
      <p style={{ color: 'var(--aws-text-secondary)', fontSize: 13, marginBottom: 20 }}>
        Log streams in this log group. Each Lambda invocation batch creates one stream.
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
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--aws-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            Log streams
            <span style={{ fontWeight: 400, color: 'var(--aws-text-secondary)', fontSize: 13 }}> ({streams.length})</span>
          </span>
          <button className="aws-btn-icon" style={{ marginLeft: 'auto' }} onClick={load} disabled={loading} title="Refresh">
            <RefreshCw size={14} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }}/>
          </button>
        </div>

        {/* Table */}
        <table className="aws-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('name')}>
                Log stream name <SortIcon col="name" sortCol={sortCol} sortDir={sortDir}/>
              </th>
              <th className="sortable" onClick={() => handleSort('lastEvent')}>
                Last event time <SortIcon col="lastEvent" sortCol={sortCol} sortDir={sortDir}/>
              </th>
              <th className="sortable" onClick={() => handleSort('created')}>
                Creation time <SortIcon col="created" sortCol={sortCol} sortDir={sortDir}/>
              </th>
              <th>Size</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--aws-text-secondary)' }}>
                    <span className="aws-spinner"/> Loading log streams…
                  </div>
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="aws-empty-state">
                    <div className="aws-empty-state-title">No log streams</div>
                    <div className="aws-empty-state-desc">
                      Invoke the Lambda function to generate log streams.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map(s => (
                <tr key={s.logStreamName} style={{ cursor: 'pointer' }} onClick={() => openEvents(s.logStreamName)}>
                  <td>
                    <span style={{ color: 'var(--aws-blue)', fontWeight: 500 }}>
                      {s.logStreamName}
                    </span>
                  </td>
                  <td style={{ color: 'var(--aws-text-secondary)' }}>{formatDate(s.lastEventTimestamp)}</td>
                  <td style={{ color: 'var(--aws-text-secondary)' }}>{formatDate(s.creationTime)}</td>
                  <td style={{ color: 'var(--aws-text-secondary)' }}>{formatBytes(s.storedBytes)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
