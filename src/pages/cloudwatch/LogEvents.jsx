import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { RefreshCw, X } from 'lucide-react';
import { getLogEvents } from '../../lib/cloudwatchClient';

// Classify log line type for colour coding
function lineType(msg) {
  if (/^START RequestId/.test(msg)) return 'start';
  if (/^END RequestId/.test(msg))   return 'end';
  if (/^REPORT RequestId/.test(msg)) return 'report';
  if (/\tERROR\t/.test(msg) || /\[ERROR\]/.test(msg)) return 'error';
  if (/\tWARN\t/.test(msg)  || /\[WARN\]/.test(msg))  return 'warn';
  return 'info';
}

const TYPE_COLOR = {
  start:  '#79c0ff',
  end:    '#79c0ff',
  report: '#8b949e',
  error:  '#ff7b72',
  warn:   '#e3b341',
  info:   '#c9d1d9',
};

// Pretty-format a raw CloudWatch log message
function formatMessage(msg) {
  // CloudWatch format: "TIMESTAMP\tREQUESTID\tLEVEL\tMESSAGE"
  const cwMatch = msg.match(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\t[^\t]+\t(\w+)\t(.+)$/s);
  if (cwMatch) return `[${cwMatch[1]}] ${cwMatch[2]}`;
  return msg;
}

function formatTs(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

export default function LogEvents() {
  const [searchParams] = useSearchParams();
  const groupName  = searchParams.get('group')  || '';
  const streamName = searchParams.get('stream') || '';

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef(null);
  const bottomRef   = useRef(null);

  const load = useCallback(async () => {
    if (!groupName || !streamName) return;
    setLoading(true);
    try {
      const data = await getLogEvents(groupName, streamName);
      setEvents(data);
    } catch (err) {
      setError(`Failed to load log events: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [groupName, streamName]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 5000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, load]);

  // Scroll to bottom when events update
  useEffect(() => {
    if (autoRefresh) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events, autoRefresh]);

  const shortStream = streamName.length > 60 ? '…' + streamName.slice(-55) : streamName;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="aws-breadcrumb">
        <span style={{ color: 'var(--aws-text-secondary)' }}>CloudWatch</span>
        <span className="aws-breadcrumb-sep">›</span>
        <Link to="/cloudwatch/logs" style={{ color: 'var(--aws-blue)' }}>Log groups</Link>
        <span className="aws-breadcrumb-sep">›</span>
        <Link
          to={`/cloudwatch/logs/streams?group=${encodeURIComponent(groupName)}`}
          style={{ color: 'var(--aws-blue)' }}
        >
          {groupName}
        </Link>
        <span className="aws-breadcrumb-sep">›</span>
        <span style={{ fontWeight: 700 }}>{shortStream}</span>
      </div>

      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, wordBreak: 'break-all' }}>{streamName}</h1>
      <p style={{ color: 'var(--aws-text-secondary)', fontSize: 13, marginBottom: 20 }}>
        Log group: <strong>{groupName}</strong>
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
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--aws-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            Log events
            <span style={{ fontWeight: 400, color: 'var(--aws-text-secondary)', fontSize: 13 }}> ({events.length})</span>
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--aws-text-secondary)' }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh (5s)
            </label>
            <button className="aws-btn-icon" onClick={load} disabled={loading} title="Refresh">
              <RefreshCw size={14} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }}/>
            </button>
          </div>
        </div>

        {/* Log output */}
        <div style={{
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: 12.5,
          lineHeight: 1.6,
          background: '#0d1117',
          minHeight: 300,
          maxHeight: 620,
          overflowY: 'auto',
          padding: '12px 16px',
        }}>
          {loading && events.length === 0 ? (
            <div style={{ color: '#8b949e', padding: '20px 0', textAlign: 'center' }}>
              <span className="aws-spinner" style={{ borderColor: '#8b949e', borderTopColor: 'transparent', width: 20, height: 20 }}/>
            </div>
          ) : events.length === 0 ? (
            <div style={{ color: '#8b949e', padding: '20px 0', textAlign: 'center' }}>
              No log events found in this stream.
            </div>
          ) : (
            events.map((ev, i) => {
              const type    = lineType(ev.message || '');
              const message = formatMessage(ev.message || '');
              return (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '1px 0', borderBottom: '1px solid #1c2128' }}>
                  <span style={{ color: '#6e7681', flexShrink: 0, minWidth: 90, userSelect: 'none', fontSize: 11.5 }}>
                    {formatTs(ev.timestamp)}
                  </span>
                  <span style={{ color: TYPE_COLOR[type], whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {message}
                  </span>
                </div>
              );
            })
          )}
          <div ref={bottomRef}/>
        </div>
      </div>
    </div>
  );
}
