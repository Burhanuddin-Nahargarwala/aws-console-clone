import { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Search, Bell, HelpCircle, ChevronDown, ChevronRight, X, Terminal } from 'lucide-react';
import { AwsServiceIcon } from './ServiceIcons';

/* ── AWS Logo — white "aws" + orange swoosh arrow (navbar version) ── */
function AwsLogoSvg() {
  return (
    <svg
      width="58" height="34"
      viewBox="0 0 58 34"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block' }}
      aria-label="Amazon Web Services"
    >
      {/* "aws" in white — matches the real logo weight/style */}
      <text
        x="1" y="22"
        fontSize="22"
        fontWeight="900"
        fontFamily="'Amazon Ember','Helvetica Neue',Arial,sans-serif"
        fill="white"
        letterSpacing="-1"
      >aws</text>

      {/* Orange swoosh: starts bottom-left, curves down-right, arrow tip upper-right */}
      <path
        d="M2 28 C 12 36, 36 36, 52 26"
        stroke="#ff9900"
        strokeWidth="2.8"
        fill="none"
        strokeLinecap="round"
      />
      {/* Arrow tip — small upward-right hook at end of swoosh */}
      <path
        d="M48 23 L52 26 L49 30"
        stroke="#ff9900"
        strokeWidth="2.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Services grid icon ────────────────────────────────────────────── */
function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="5" height="5" rx="1" opacity="0.9"/>
      <rect x="6.5" y="0" width="5" height="5" rx="1" opacity="0.9"/>
      <rect x="13" y="0" width="5" height="5" rx="1" opacity="0.9"/>
      <rect x="0" y="6.5" width="5" height="5" rx="1" opacity="0.9"/>
      <rect x="6.5" y="6.5" width="5" height="5" rx="1" opacity="0.9"/>
      <rect x="13" y="6.5" width="5" height="5" rx="1" opacity="0.9"/>
      <rect x="0" y="13" width="5" height="5" rx="1" opacity="0.9"/>
      <rect x="6.5" y="13" width="5" height="5" rx="1" opacity="0.9"/>
      <rect x="13" y="13" width="5" height="5" rx="1" opacity="0.9"/>
    </svg>
  );
}

/* ── Region data ───────────────────────────────────────────────────── */
const REGION_GROUPS = [
  {
    group: 'US East',
    regions: [
      { code: 'us-east-1', label: 'US East (N. Virginia)' },
      { code: 'us-east-2', label: 'US East (Ohio)' },
    ]
  },
  {
    group: 'US West',
    regions: [
      { code: 'us-west-1', label: 'US West (N. California)' },
      { code: 'us-west-2', label: 'US West (Oregon)' },
    ]
  },
  {
    group: 'Asia Pacific',
    regions: [
      { code: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
      { code: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
      { code: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
      { code: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
      { code: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
    ]
  },
  {
    group: 'Europe',
    regions: [
      { code: 'eu-west-1', label: 'Europe (Ireland)' },
      { code: 'eu-west-2', label: 'Europe (London)' },
      { code: 'eu-central-1', label: 'Europe (Frankfurt)' },
      { code: 'eu-north-1', label: 'Europe (Stockholm)' },
    ]
  },
  {
    group: 'South America',
    regions: [{ code: 'sa-east-1', label: 'South America (São Paulo)' }]
  },
  {
    group: 'Canada',
    regions: [{ code: 'ca-central-1', label: 'Canada (Central)' }]
  },
];

/* ── S3 Sidebar with collapsible sections ──────────────────────────── */
const S3_NAV = [
  {
    label: 'Buckets',
    items: [
      { label: 'General purpose buckets', path: '/s3' },
      { label: 'Directory buckets', path: '/s3/directory-buckets' },
      { label: 'Table buckets', path: '/s3/table-buckets' },
      { label: 'Vector buckets', path: '/s3/vector-buckets' },
    ]
  },
  {
    label: 'Files',
    items: [
      { label: 'File systems', path: '/s3/file-systems', badge: 'New' },
    ]
  },
  {
    label: 'Access management and security',
    items: [
      { label: 'Access Points', path: '/s3/access-points' },
      { label: 'Access Points for FSx', path: '/s3/access-points-fsx' },
      { label: 'Access Grants', path: '/s3/access-grants' },
      { label: 'IAM Access Analyzer', path: '/s3/access-analyzer' },
    ]
  },
  {
    label: 'Storage management and insights',
    items: [
      { label: 'Storage Lens', path: '/s3/storage-lens' },
      { label: 'Batch Operations', path: '/s3/batch' },
    ]
  },
];

function S3Sidebar({ pathname }) {
  const [collapsed, setCollapsed] = useState({});

  const toggle = (label) =>
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));

  return (
    <aside className="aws-sidebar">
      <div className="aws-sidebar-service-title">Amazon S3</div>
      {S3_NAV.map(section => {
        const isOpen = !collapsed[section.label];
        return (
          <div key={section.label} className="aws-sidebar-section">
            <div
              className="aws-sidebar-section-header"
              onClick={() => toggle(section.label)}
            >
              <span>{section.label}</span>
              {isOpen ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
            </div>
            {isOpen && section.items.map(item => {
              const isActive = pathname === item.path
                || (item.path === '/s3' && (pathname === '/s3' || pathname.startsWith('/s3/bucket')));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`aws-sidebar-link${isActive ? ' active' : ''}`}
                >
                  {item.label}
                  {item.badge && (
                    <span style={{ marginLeft: 4, fontSize: 10, background: '#0073bb', color: 'white', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}

/* ── Default sidebar (console home) ───────────────────────────────── */
const HOME_SERVICES = [
  { label: 'S3', path: '/s3', color: '#3f8624' },
  { label: 'EC2', path: '/', color: '#e07b00' },
  { label: 'Lambda', path: '/', color: '#e07b00' },
  { label: 'RDS', path: '/', color: '#3f8624' },
  { label: 'CloudWatch', path: '/', color: '#e7157b' },
  { label: 'IAM', path: '/', color: '#dd344c' },
  { label: 'DynamoDB', path: '/', color: '#527fff' },
];

function DefaultSidebar({ pathname }) {
  return (
    <aside className="aws-sidebar">
      <div className="aws-sidebar-section-label" style={{ paddingTop: 14 }}>Recently visited</div>
      {HOME_SERVICES.map((s, i) => (
        <Link key={i} to={s.path} className="aws-sidebar-generic-link">
          <AwsServiceIcon service={s.label} size={20}/>
          {s.label}
        </Link>
      ))}
    </aside>
  );
}

/* ── Main Layout ───────────────────────────────────────────────────── */
export default function AwsLayout() {
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [regionOpen, setRegionOpen] = useState(false);
  const [currentRegion, setCurrentRegion] = useState({ code: 'ap-south-1', label: 'Asia Pacific (Mumbai)' });
  const regionRef = useRef();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isInsideS3 = pathname.startsWith('/s3');

  const allRegions = REGION_GROUPS.flatMap(g => g.regions);

  // Close region dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (regionRef.current && !regionRef.current.contains(e.target)) setRegionOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const services = [
    { name: 'S3', desc: 'Scalable Storage in the Cloud', path: '/s3', color: '#3f8624' },
    { name: 'EC2', desc: 'Virtual Servers in the Cloud', path: '/', color: '#e07b00' },
    { name: 'Lambda', desc: 'Run Code without Thinking about Servers', path: '/', color: '#e07b00' },
    { name: 'DynamoDB', desc: 'Managed NoSQL Database', path: '/', color: '#527fff' },
    { name: 'IAM', desc: 'Manage access to AWS resources', path: '/', color: '#dd344c' },
    { name: 'CloudWatch', desc: 'Monitor Resources and Applications', path: '/', color: '#e7157b' },
    { name: 'RDS', desc: 'Managed Relational Database Service', path: '/', color: '#3f8624' },
    { name: 'VPC', desc: 'Isolated Cloud Resources', path: '/', color: '#8c4fff' },
  ];
  const filtered = searchQuery
    ? services.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : services;

  const handleSearchSelect = (path) => {
    setSearchFocused(false);
    setSearchQuery('');
    navigate(path);
  };

  const favItems = ['S3', 'EC2', 'Lambda', 'RDS', 'CloudWatch', 'IAM'];
  const favPaths = { S3: '/s3', EC2: '/', Lambda: '/', RDS: '/', CloudWatch: '/', IAM: '/' };

  return (
    <div className="app-container">

      {/* ── Top Navbar ────────────────────────────────────────────── */}
      <header className="aws-navbar">
        {/* Hamburger */}
        <button className="aws-navbar-btn" style={{ padding: '0 6px' }}>
          <svg width="18" height="14" viewBox="0 0 18 14" fill="white">
            <rect y="0" width="18" height="2" rx="1"/><rect y="6" width="18" height="2" rx="1"/><rect y="12" width="18" height="2" rx="1"/>
          </svg>
        </button>

        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', marginRight: 4 }}>
          <AwsLogoSvg/>
        </Link>

        {/* Services grid */}
        <button className="aws-navbar-btn" style={{ padding: '0 8px' }} title="All services">
          <GridIcon/>
        </button>

        {/* Search */}
        <div className="aws-navbar-search-wrap">
          <div className={`aws-navbar-search-inner${searchFocused ? ' focused' : ''}`}>
            <Search size={13} color={searchFocused ? '#545b64' : '#aab7b8'} style={{ flexShrink: 0 }}/>
            <input
              type="text"
              placeholder="Search for services, features, blogs, docs, and more [Alt+S]"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            />
            <span style={{ fontSize: 11, color: searchFocused ? '#545b64' : '#aab7b8', whiteSpace: 'nowrap', marginLeft: 4 }}>[Alt+S]</span>
          </div>

          {searchFocused && (
            <div className="aws-search-dropdown">
              <div className="aws-search-dropdown-section">Services</div>
              {filtered.map(svc => (
                <div key={svc.name} className="aws-search-dropdown-item" onClick={() => handleSearchSelect(svc.path)}>
                  <AwsServiceIcon service={svc.name} size={32}/>
                  <div>
                    <h4>{svc.name}</h4>
                    <p>{svc.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
          <button className="aws-navbar-btn" title="CloudShell">
            <Terminal size={15}/>
          </button>
          <button className="aws-navbar-btn" title="Notifications">
            <Bell size={15}/>
          </button>
          <button className="aws-navbar-btn">
            <HelpCircle size={15}/> Support <ChevronDown size={11}/>
          </button>

          {/* Region dropdown */}
          <div ref={regionRef} style={{ position: 'relative' }}>
            <button
              className="aws-navbar-btn"
              style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: 12 }}
              onClick={() => setRegionOpen(o => !o)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentRegion.label}
              </span>
              <ChevronDown size={11}/>
            </button>

            {regionOpen && (
              <div className="aws-region-dropdown">
                {REGION_GROUPS.map(group => (
                  <div key={group.group}>
                    <div className="aws-region-group-label">{group.group}</div>
                    {group.regions.map(r => (
                      <div
                        key={r.code}
                        className={`aws-region-item${r.code === currentRegion.code ? ' active' : ''}`}
                        onClick={() => { setCurrentRegion(r); setRegionOpen(false); }}
                      >
                        {r.code === currentRegion.code && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--aws-blue)" style={{ flexShrink: 0 }}>
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                        <span style={{ marginLeft: r.code === currentRegion.code ? 0 : 20 }}>
                          {r.label} <span style={{ color: 'var(--aws-text-secondary)', fontSize: 11 }}>{r.code}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Account */}
          <button
            className="aws-navbar-btn"
            style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: 12, flexDirection: 'column', alignItems: 'flex-start', height: 'auto', padding: '4px 12px', gap: 0 }}
          >
            <span style={{ fontSize: 12, fontWeight: 700 }}>floci-user</span>
            <span style={{ fontSize: 10, color: '#aab7b8' }}>AdministratorAccess</span>
          </button>
        </div>
      </header>

      {/* ── Favorites Bar ─────────────────────────────────────────── */}
      <div className="aws-fav-bar">
        {favItems.map(label => (
          <Link
            key={label}
            to={favPaths[label]}
            className={`aws-fav-bar-item${pathname.startsWith(favPaths[label]) && favPaths[label] !== '/' ? ' active' : ''}`}
          >
            {label}
          </Link>
        ))}
        <span style={{ marginLeft: 8, color: '#aab7b8', fontSize: 12, cursor: 'pointer', padding: '0 8px' }}>
          ⊕ Edit
        </span>
      </div>

      {/* ── Main layout ───────────────────────────────────────────── */}
      <div className="main-layout">
        {isInsideS3 ? <S3Sidebar pathname={pathname}/> : <DefaultSidebar pathname={pathname}/>}
        <main className="content-area" style={{ marginLeft: 'var(--sidebar-width)' }}>
          <Outlet/>
        </main>
      </div>

      {/* ── Site Footer ───────────────────────────────────────────── */}
      <footer className="aws-site-footer">
        <span>© 2024, Amazon Web Services, Inc. or its affiliates.</span>
        <div className="aws-site-footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Cookie preferences</a>
          <a href="#">Site feedback</a>
        </div>
      </footer>
    </div>
  );
}
