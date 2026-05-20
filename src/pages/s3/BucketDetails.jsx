import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand,
  DeleteObjectsCommand, GetObjectCommand,
} from '@aws-sdk/client-s3';
import {
  FileText, FolderOpen, Search, Upload, RefreshCw,
  ChevronDown, Copy, Download, Trash2, Settings, X, Plus, Info,
} from 'lucide-react';
import { s3Client } from '../../aws-client';

/* ── Helpers ───────────────────────────────────────────────────────── */
function formatSize(bytes) {
  if (bytes == null) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short',
  });
}

function getFileType(key) {
  if (!key || key.endsWith('/')) return 'Folder';
  const ext = key.split('.').pop();
  return ext ? ext.toUpperCase() : '—';
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

/* ── Delete confirmation modal ─────────────────────────────────────── */
function DeleteModal({ items, onConfirm, onClose }) {
  const [input, setInput] = useState('');
  const required = 'permanently delete';
  return (
    <div className="aws-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="aws-modal" style={{ maxWidth: 520 }}>
        <div className="aws-modal-header">
          <h2>Delete objects?</h2>
          <button className="aws-btn-link" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="aws-modal-body">
          <div className="aws-alert aws-alert-error" style={{ marginBottom: 14 }}>
            <X size={14} color="var(--aws-error)" style={{ flexShrink: 0 }}/>
            <span style={{ fontSize: 13 }}>
              This action <strong>cannot be undone</strong>. The following {items.length} object{items.length !== 1 ? 's' : ''} will be permanently deleted.
            </span>
          </div>
          <div style={{ maxHeight: 140, overflowY: 'auto', background: '#f7f9fa', border: '1px solid var(--aws-border)', borderRadius: 4, padding: '8px 12px', marginBottom: 16 }}>
            {items.map(k => (
              <div key={k} style={{ fontSize: 13, padding: '2px 0', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 6 }}>
                {k.endsWith('/') ? <FolderOpen size={13} color="#d08000"/> : <FileText size={13} color="var(--aws-text-secondary)"/>}
                {k}
              </div>
            ))}
          </div>
          <div className="aws-form-field">
            <label className="aws-form-label">
              To confirm deletion, type: <strong>{required}</strong>
            </label>
            <input
              type="text"
              className="aws-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              autoFocus
            />
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
            Delete objects
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Object details modal ──────────────────────────────────────────── */
function ObjectDetailsModal({ bucketName, objectKey, onClose, onCopy }) {
  const s3Uri = `s3://${bucketName}/${objectKey}`;
  const httpUrl = `${window.location.origin}/s3-api/${bucketName}/${objectKey}`;
  return (
    <div className="aws-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="aws-modal" style={{ maxWidth: 560 }}>
        <div className="aws-modal-header">
          <h2 style={{ fontSize: 16, wordBreak: 'break-all' }}>{objectKey.split('/').filter(Boolean).pop()}</h2>
          <button className="aws-btn-link" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="aws-modal-body">
          <div style={{ display: 'grid', gap: 14, fontSize: 13 }}>
            {[
              { label: 'Object key', value: objectKey },
              { label: 'S3 URI', value: s3Uri, canCopy: true },
              { label: 'Object URL', value: httpUrl, canCopy: true },
            ].map(row => (
              <div key={row.label}>
                <div style={{ color: 'var(--aws-text-secondary)', fontSize: 12, marginBottom: 3 }}>{row.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, wordBreak: 'break-all' }}>
                  <span>{row.value}</span>
                  {row.canCopy && (
                    <button className="aws-btn-link" style={{ flexShrink: 0 }} onClick={() => onCopy(row.value)}>
                      <Copy size={13}/>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="aws-modal-footer">
          <button className="aws-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ── Upload Modal ──────────────────────────────────────────────────── */
function UploadModal({ bucketName, prefix, onClose, onDone }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();

  const addFiles = (newFiles) => {
    setFiles(prev => {
      const map = new Map(prev.map(f => [f.name, f]));
      newFiles.forEach(f => map.set(f.name, f));
      return Array.from(map.values());
    });
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    const initial = {};
    files.forEach(f => { initial[f.name] = 'pending'; });
    setProgress(initial);

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const body = new Uint8Array(arrayBuffer);
        await s3Client.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: prefix + file.name,
          Body: body,
          ContentType: file.type || 'application/octet-stream',
        }));
        setProgress(prev => ({ ...prev, [file.name]: 'done' }));
      } catch (err) {
        console.error('Upload error', file.name, err);
        setProgress(prev => ({ ...prev, [file.name]: 'error' }));
      }
    }
    setUploading(false);
    onDone();
  };

  const allDone = files.length > 0 && files.every(f => progress[f.name] === 'done' || progress[f.name] === 'error');

  return (
    <div className="aws-modal-overlay" onClick={e => { if (e.target === e.currentTarget && !uploading) onClose(); }}>
      <div className="aws-modal">
        <div className="aws-modal-header">
          <h2>Upload</h2>
          <button className="aws-btn-link" onClick={onClose} disabled={uploading}><X size={16}/></button>
        </div>
        <div className="aws-modal-body">
          <p style={{ fontSize: 13, color: 'var(--aws-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
            Add files to upload to <strong>{bucketName}</strong>{prefix ? ` / ${prefix}` : ''}.
          </p>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }}
            onClick={() => fileInputRef.current.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--aws-blue)' : 'var(--aws-border-dark)'}`,
              borderRadius: 8, padding: 32, textAlign: 'center', cursor: 'pointer',
              background: dragOver ? '#f0f7fb' : '#fafafa', transition: 'all 0.15s', marginBottom: 16,
            }}
          >
            <Upload size={28} color="var(--aws-text-secondary)" style={{ marginBottom: 8 }}/>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              Drag and drop files or <span style={{ color: 'var(--aws-blue)' }}>Browse</span>
            </div>
          </div>
          <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
            onChange={e => addFiles(Array.from(e.target.files))} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className="aws-btn" onClick={() => fileInputRef.current.click()}>
              <Plus size={13}/> Add files
            </button>
          </div>
          {files.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Files ({files.length})</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--aws-border-dark)', background: '#f7f9fa' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left' }}>Name</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right' }}>Size</th>
                    <th style={{ padding: '6px 10px', textAlign: 'center' }}>Status</th>
                    <th style={{ width: 32 }}/>
                  </tr>
                </thead>
                <tbody>
                  {files.map(f => {
                    const st = progress[f.name];
                    return (
                      <tr key={f.name} style={{ borderBottom: '1px solid var(--aws-border)' }}>
                        <td style={{ padding: '7px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileText size={14} color="var(--aws-text-secondary)"/>
                            <span style={{ wordBreak: 'break-all' }}>{f.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--aws-text-secondary)' }}>{formatSize(f.size)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                          {!st && <span style={{ color: 'var(--aws-text-secondary)', fontSize: 12 }}>Pending</span>}
                          {st === 'pending' && <span className="aws-spinner" style={{ width: 14, height: 14 }}/>}
                          {st === 'done' && <span style={{ color: 'var(--aws-success)', fontSize: 12, fontWeight: 700 }}>✓ Uploaded</span>}
                          {st === 'error' && <span style={{ color: 'var(--aws-error)', fontSize: 12 }}>✗ Failed</span>}
                        </td>
                        <td style={{ padding: '7px 6px' }}>
                          {!uploading && (
                            <button className="aws-btn-link" onClick={() => setFiles(p => p.filter(x => x.name !== f.name))}
                              style={{ color: 'var(--aws-error)', padding: 2 }}>
                              <X size={13}/>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="aws-modal-footer">
          {allDone ? (
            <button className="aws-btn aws-btn-primary" onClick={onClose}>Close</button>
          ) : (
            <>
              <button className="aws-btn" onClick={onClose} disabled={uploading}>Cancel</button>
              <button className="aws-btn aws-btn-primary" onClick={handleUpload} disabled={uploading || files.length === 0}>
                {uploading
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="aws-spinner" style={{ width: 14, height: 14, borderWidth: 2 }}/> Uploading…</span>
                  : `Upload (${files.length} file${files.length !== 1 ? 's' : ''})`
                }
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Create Folder Modal ───────────────────────────────────────────── */
function CreateFolderModal({ bucketName, prefix, onClose, onDone }) {
  const [folderName, setFolderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!folderName) { setError('Folder name is required.'); return; }
    if (/[\\]/.test(folderName)) { setError('Folder name must not contain backslashes.'); return; }
    setLoading(true);
    setError('');
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: prefix + folderName + '/',
        Body: '',
        ContentType: 'application/x-directory',
      }));
      onDone();
      onClose();
    } catch (err) {
      setError('Failed to create folder: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="aws-modal-overlay" onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div className="aws-modal" style={{ maxWidth: 480 }}>
        <div className="aws-modal-header">
          <h2>Create folder</h2>
          <button className="aws-btn-link" onClick={onClose} disabled={loading}><X size={16}/></button>
        </div>
        <div className="aws-modal-body">
          <p style={{ fontSize: 13, color: 'var(--aws-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
            Folders in S3 are objects with a key ending in <strong>/</strong>.
            {prefix && <> This will be created inside <strong>{prefix}</strong>.</>}
          </p>
          {error && (
            <div className="aws-alert aws-alert-error" style={{ marginBottom: 12 }}>
              <X size={14} color="var(--aws-error)" style={{ flexShrink: 0 }}/>
              <span style={{ fontSize: 13 }}>{error}</span>
            </div>
          )}
          <div className="aws-form-field">
            <label className="aws-form-label">Folder name</label>
            <input type="text" className="aws-input" placeholder="my-folder" value={folderName}
              onChange={e => { setFolderName(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus
              style={{ borderColor: error ? 'var(--aws-error)' : undefined }}
            />
          </div>
          {folderName && !error && (
            <div style={{ padding: '8px 12px', background: '#f7f9fa', borderRadius: 4, border: '1px solid var(--aws-border-dark)', fontSize: 13 }}>
              <span style={{ color: 'var(--aws-text-secondary)' }}>S3 key: </span>
              <strong>{prefix}{folderName}/</strong>
            </div>
          )}
        </div>
        <div className="aws-modal-footer">
          <button className="aws-btn" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="aws-btn aws-btn-primary" onClick={handleCreate} disabled={loading || !folderName}>
            {loading
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="aws-spinner" style={{ width: 14, height: 14, borderWidth: 2 }}/> Creating…</span>
              : 'Create folder'
            }
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Actions Dropdown ──────────────────────────────────────────────── */
function ActionsDropdown({ disabled, onDownload, onDelete, onCopyUri, onCopyUrl }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const act = fn => { setOpen(false); fn(); };
  return (
    <div className="aws-dropdown" ref={ref}>
      <button className="aws-btn" disabled={disabled} onClick={() => setOpen(o => !o)}>
        Actions <ChevronDown size={12}/>
      </button>
      {open && !disabled && (
        <div className="aws-dropdown-menu">
          <div className="aws-dropdown-item" onClick={() => act(onDownload)}><Download size={13}/> Download</div>
          <div className="aws-dropdown-item" onClick={() => act(onCopyUri)}><Copy size={13}/> Copy S3 URI</div>
          <div className="aws-dropdown-item" onClick={() => act(onCopyUrl)}><Copy size={13}/> Copy URL</div>
          <div className="aws-dropdown-divider"/>
          <div className="aws-dropdown-item danger" onClick={() => act(onDelete)}><Trash2 size={13}/> Delete</div>
        </div>
      )}
    </div>
  );
}

/* ── Properties Tab ────────────────────────────────────────────────── */
function PropertiesTab({ bucketName }) {
  return (
    <div className="aws-panel">
      <div className="aws-panel-header">Bucket overview</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, fontSize: 13 }}>
        <div>
          <div style={{ color: 'var(--aws-text-secondary)', marginBottom: 4, fontSize: 12 }}>AWS Region</div>
          <div>Asia Pacific (Mumbai) ap-south-1</div>
        </div>
        <div>
          <div style={{ color: 'var(--aws-text-secondary)', marginBottom: 4, fontSize: 12 }}>Amazon Resource Name (ARN)</div>
          <div style={{ wordBreak: 'break-all' }}>arn:aws:s3:::{bucketName}</div>
        </div>
        <div>
          <div style={{ color: 'var(--aws-text-secondary)', marginBottom: 4, fontSize: 12 }}>Block Public Access</div>
          <span style={{ color: 'var(--aws-success)', fontWeight: 700 }}>✓ On</span>
        </div>
      </div>
    </div>
  );
}

function StubPanel({ title, desc }) {
  return (
    <div className="aws-panel" style={{ textAlign: 'center', padding: 48 }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ color: 'var(--aws-text-secondary)', fontSize: 13, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────── */
export default function BucketDetails() {
  const { bucketName, '*': wildcardPath } = useParams();
  const navigate = useNavigate();

  // prefix always ends with '/' or is empty string
  const prefix = wildcardPath
    ? (wildcardPath.endsWith('/') ? wildcardPath : wildcardPath + '/')
    : '';

  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('objects');
  const [selected, setSelected] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [objectDetailsKey, setObjectDetailsKey] = useState(null);
  const [toast, setToast] = useState('');

  const showToast = msg => setToast(msg);

  const fetchObjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await s3Client.send(new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        Delimiter: '/',
      }));

      // Folders come from CommonPrefixes, files from Contents (excluding the prefix object itself)
      const folders = (data.CommonPrefixes || []).map(cp => ({
        Key: cp.Prefix,
        isFolder: true,
        LastModified: null,
        Size: null,
        StorageClass: null,
      }));
      const files = (data.Contents || []).filter(obj => obj.Key !== prefix);

      setObjects([...folders, ...files]);
    } catch (err) {
      console.error(err);
      setError('Error fetching objects: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [bucketName, prefix]);

  useEffect(() => {
    fetchObjects();
    setSelected(new Set());
    setSearchQuery('');
  }, [fetchObjects]);

  /* ── Copy to clipboard ─────────────────────────────────────────── */
  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied`);
    } catch {
      showToast('Copy failed — check browser permissions');
    }
  };

  const copyArn = () => copyToClipboard(`arn:aws:s3:::${bucketName}`, 'ARN');

  const copyS3Uri = (keys) => {
    const uris = Array.from(keys).map(k => `s3://${bucketName}/${k}`).join('\n');
    copyToClipboard(uris, 'S3 URI');
  };

  const copyUrl = (keys) => {
    const urls = Array.from(keys).map(k => `${window.location.origin}/s3-api/${bucketName}/${k}`).join('\n');
    copyToClipboard(urls, 'URL');
  };

  /* ── Download ──────────────────────────────────────────────────── */
  const handleDownload = async (keys) => {
    for (const key of keys) {
      if (key.endsWith('/')) continue; // skip folders
      try {
        const response = await s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
        const reader = response.Body.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const blob = new Blob(chunks, { type: response.ContentType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = key.split('/').filter(Boolean).pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        setError('Download failed: ' + err.message);
      }
    }
  };

  /* ── Delete ────────────────────────────────────────────────────── */
  const handleDelete = async () => {
    try {
      for (const key of selected) {
        await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
      }
      setSelected(new Set());
      fetchObjects();
      showToast(`${selected.size} object${selected.size !== 1 ? 's' : ''} deleted`);
    } catch (err) {
      setError('Delete failed: ' + err.message);
    }
  };

  /* ── Selection helpers ─────────────────────────────────────────── */
  const filtered = objects.filter(o =>
    !searchQuery || o.Key.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const allChecked = filtered.length > 0 && filtered.every(o => selected.has(o.Key));
  const someChecked = filtered.some(o => selected.has(o.Key));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(filtered.map(o => o.Key)));
  const toggleOne = key => setSelected(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const anySelected = selected.size > 0;

  /* ── Breadcrumb ────────────────────────────────────────────────── */
  const prefixParts = prefix.split('/').filter(Boolean);

  const TABS = [
    { id: 'objects', label: 'Objects' },
    { id: 'properties', label: 'Properties' },
    { id: 'permissions', label: 'Permissions' },
    { id: 'metrics', label: 'Metrics' },
    { id: 'management', label: 'Management' },
    { id: 'access-points', label: 'Access Points' },
    { id: 'intelligent-tiering', label: 'Intelligent-Tiering Archive configurations' },
  ];

  return (
    <div>
      {/* Modals */}
      {showUpload && (
        <UploadModal bucketName={bucketName} prefix={prefix}
          onClose={() => setShowUpload(false)} onDone={fetchObjects} />
      )}
      {showCreateFolder && (
        <CreateFolderModal bucketName={bucketName} prefix={prefix}
          onClose={() => setShowCreateFolder(false)} onDone={fetchObjects} />
      )}
      {showDeleteModal && anySelected && (
        <DeleteModal
          items={Array.from(selected)}
          onConfirm={handleDelete}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
      {objectDetailsKey && (
        <ObjectDetailsModal
          bucketName={bucketName}
          objectKey={objectDetailsKey}
          onClose={() => setObjectDetailsKey(null)}
          onCopy={(text) => copyToClipboard(text, 'Value')}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast('')}/>}

      {/* Breadcrumb */}
      <div className="aws-breadcrumb">
        <Link to="/s3" style={{ color: 'var(--aws-blue)' }}>Amazon S3</Link>
        <span className="aws-breadcrumb-sep">›</span>
        <Link to="/s3" style={{ color: 'var(--aws-blue)' }}>Buckets</Link>
        <span className="aws-breadcrumb-sep">›</span>
        <Link to={`/s3/bucket/${bucketName}`} style={{ color: prefixParts.length ? 'var(--aws-blue)' : 'inherit', fontWeight: prefixParts.length ? 400 : 700 }}>
          {bucketName}
        </Link>
        {prefixParts.map((part, i) => {
          const isLast = i === prefixParts.length - 1;
          const partPrefix = prefixParts.slice(0, i + 1).join('/') + '/';
          return (
            <span key={partPrefix}>
              <span className="aws-breadcrumb-sep">›</span>
              {isLast
                ? <span style={{ fontWeight: 700 }}>{part}</span>
                : <Link to={`/s3/bucket/${bucketName}/${partPrefix}`} style={{ color: 'var(--aws-blue)' }}>{part}</Link>
              }
            </span>
          );
        })}
      </div>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          {prefixParts.length ? prefixParts[prefixParts.length - 1] : bucketName}
        </h1>
        <button className="aws-btn" style={{ fontSize: 12 }} onClick={copyArn}>
          <Copy size={12}/> Copy ARN
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="aws-alert aws-alert-error" style={{ marginBottom: 16 }}>
          <X size={16} color="var(--aws-error)" style={{ flexShrink: 0 }}/>
          <div><div className="aws-alert-title">Error</div><div style={{ fontSize: 13 }}>{error}</div></div>
          <button className="aws-btn-link" style={{ marginLeft: 'auto' }} onClick={() => setError('')}><X size={14}/></button>
        </div>
      )}

      {/* Tabs */}
      <div className="aws-tabs">
        {TABS.map(tab => (
          <div key={tab.id} className={`aws-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </div>
        ))}
      </div>

      {/* Objects tab */}
      {activeTab === 'objects' && (
        <div className="aws-panel" style={{ padding: 0 }}>
          {/* Toolbar */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--aws-border)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, fontWeight: 700, marginRight: 4 }}>
              Objects
              <span style={{ fontWeight: 400, color: 'var(--aws-text-secondary)', fontSize: 14 }}> ({filtered.length})</span>
            </span>
            <span className="aws-info-link"><Info size={12} style={{ display: 'inline', verticalAlign: 'middle' }}/> Info</span>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="aws-btn" disabled={!anySelected}
                onClick={() => copyS3Uri(selected)}>
                <Copy size={13}/> Copy S3 URI
              </button>
              <button className="aws-btn" disabled={!anySelected}
                onClick={() => copyUrl(selected)}>
                <Copy size={13}/> Copy URL
              </button>
              <button className="aws-btn" disabled={!anySelected}
                onClick={() => handleDownload(selected)}>
                <Download size={13}/> Download
              </button>
              <ActionsDropdown
                disabled={!anySelected}
                onDownload={() => handleDownload(selected)}
                onDelete={() => setShowDeleteModal(true)}
                onCopyUri={() => copyS3Uri(selected)}
                onCopyUrl={() => copyUrl(selected)}
              />
              <button className="aws-btn-icon" onClick={fetchObjects} title="Refresh"><RefreshCw size={13}/></button>
              <button className="aws-btn" style={{ padding: '4px 10px' }}><Settings size={13}/></button>
              <button className="aws-btn" onClick={() => setShowCreateFolder(true)}>
                <FolderOpen size={13}/> Create folder
              </button>
              <button className="aws-btn aws-btn-primary" onClick={() => setShowUpload(true)}>
                <Upload size={13}/> Upload
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--aws-border)' }}>
            <p style={{ color: 'var(--aws-text-secondary)', fontSize: 13, marginBottom: 10 }}>
              Objects are the fundamental entities stored in Amazon S3.
            </p>
            <div style={{ position: 'relative', maxWidth: 480 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--aws-text-secondary)', pointerEvents: 'none' }}/>
              <input type="text" className="aws-input" placeholder="Find objects by prefix"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 32 }} />
            </div>
          </div>

          {/* Table */}
          <table className="aws-table">
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>
                  <input type="checkbox" checked={allChecked}
                    ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                    onChange={toggleAll} style={{ width: 14, height: 14 }}/>
                </th>
                <th>Name</th>
                <th>Type</th>
                <th>Last modified</th>
                <th style={{ textAlign: 'right' }}>Size</th>
                <th>Storage class</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--aws-text-secondary)' }}>
                      <span className="aws-spinner"/> Loading objects…
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="aws-empty-state">
                      <div style={{ fontSize: 52, marginBottom: 12 }}>📂</div>
                      <div className="aws-empty-state-title">
                        {searchQuery ? `No objects match "${searchQuery}"` : 'This folder is empty'}
                      </div>
                      <div className="aws-empty-state-desc">
                        {searchQuery ? 'Clear the search to view all objects.'
                          : 'Upload objects or create a folder to get started.'}
                      </div>
                      {!searchQuery && (
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                          <button className="aws-btn" onClick={() => setShowCreateFolder(true)}>
                            <FolderOpen size={13}/> Create folder
                          </button>
                          <button className="aws-btn aws-btn-primary" onClick={() => setShowUpload(true)}>
                            <Upload size={13}/> Upload
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(obj => {
                  const isFolder = obj.Key.endsWith('/');
                  const displayName = obj.Key.slice(prefix.length);
                  return (
                    <tr key={obj.Key} className={selected.has(obj.Key) ? 'selected' : ''}
                      onClick={() => toggleOne(obj.Key)} style={{ cursor: 'pointer' }}>
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(obj.Key)}
                          onChange={() => toggleOne(obj.Key)} style={{ width: 14, height: 14 }}/>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isFolder
                            ? <FolderOpen size={15} color="#d08000"/>
                            : <FileText size={15} color="var(--aws-text-secondary)"/>
                          }
                          {isFolder ? (
                            <button
                              className="aws-btn-link"
                              style={{ color: 'var(--aws-blue)', fontWeight: 600, padding: 0, textAlign: 'left' }}
                              onClick={e => { e.stopPropagation(); navigate(`/s3/bucket/${bucketName}/${obj.Key}`); }}
                            >
                              {displayName}
                            </button>
                          ) : (
                            <button
                              className="aws-btn-link"
                              style={{ color: 'var(--aws-blue)', fontWeight: 600, padding: 0, textAlign: 'left' }}
                              onClick={e => { e.stopPropagation(); setObjectDetailsKey(obj.Key); }}
                            >
                              {displayName}
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ color: 'var(--aws-text-secondary)' }}>{getFileType(obj.Key)}</td>
                      <td style={{ color: 'var(--aws-text-secondary)' }}>{formatDate(obj.LastModified)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--aws-text-secondary)' }}>
                        {isFolder ? '—' : formatSize(obj.Size)}
                      </td>
                      <td style={{ color: 'var(--aws-text-secondary)' }}>{obj.StorageClass || (isFolder ? '—' : 'Standard')}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'properties' && <PropertiesTab bucketName={bucketName}/>}
      {activeTab === 'permissions' && (
        <>
          <StubPanel title="Block public access (bucket settings)" desc="All block public access settings are enabled for this bucket."/>
          <StubPanel title="Bucket policy" desc="No bucket policy has been set."/>
          <StubPanel title="Access control list (ACL)" desc="ACLs are disabled for this bucket."/>
          <StubPanel title="Cross-origin resource sharing (CORS)" desc="No CORS configuration has been set."/>
        </>
      )}
      {activeTab === 'metrics' && <StubPanel title="Metrics" desc="View Amazon CloudWatch metrics for this bucket."/>}
      {activeTab === 'management' && (
        <>
          <StubPanel title="Lifecycle rules" desc="No lifecycle rules have been configured."/>
          <StubPanel title="Replication rules" desc="No replication rules have been configured."/>
        </>
      )}
      {activeTab === 'access-points' && <StubPanel title="Access Points" desc="No access points have been configured."/>}
      {activeTab === 'intelligent-tiering' && <StubPanel title="Intelligent-Tiering" desc="No archive configurations have been set."/>}
    </div>
  );
}
