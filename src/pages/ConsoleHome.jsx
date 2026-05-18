import { Link } from 'react-router-dom';
import { CheckCircle, DollarSign, BookOpen, AlertCircle } from 'lucide-react';
import { AwsServiceIcon } from '../components/ServiceIcons';

/* ── Drag handle — 6 dot grid ──────────────────────────────────────── */
function DragHandle() {
  return (
    <span className="aws-drag-handle">
      <span/><span/><span/><span/><span/><span/>
    </span>
  );
}

/* ── Widget 3-dot menu ─────────────────────────────────────────────── */
function WidgetMenu() {
  return <button className="aws-widget-menu" title="Widget options">⋮</button>;
}


export default function ConsoleHome() {
  return (
    <div style={{ maxWidth: 1300, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          Console Home
          <span style={{ fontSize: 12, color: 'var(--aws-blue)', fontWeight: 400, cursor: 'pointer' }}>Info</span>
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="aws-btn">Reset to default layout</button>
          <button className="aws-btn aws-btn-primary">+ Add widgets</button>
        </div>
      </div>

      {/* Row 1: Recently visited (left, tall) + Applications (right) + AWS Health */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Recently visited */}
        <div className="aws-widget">
          <div className="aws-widget-header">
            <DragHandle/> Recently visited
            <span style={{ fontSize: 12, color: 'var(--aws-blue)', fontWeight: 400, marginLeft: 4 }}>Info</span>
            <WidgetMenu/>
          </div>
          <div className="aws-widget-content" style={{ padding: '8px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              {[
                { name: 'S3', path: '/s3' },
                { name: 'CloudWatch', path: '/' },
                { name: 'EC2', path: '/' },
                { name: 'Athena', path: '/' },
                { name: 'Beanstalk', path: '/', label: 'Elastic Beanstalk' },
                { name: 'Lambda', path: '/' },
                { name: 'Route53', path: '/', label: 'Route 53' },
                { name: 'IAM', path: '/' },
                { name: 'VPC', path: '/' },
                { name: 'ECS', path: '/', label: 'Elastic Container Service' },
              ].map(svc => (
                <Link key={svc.name} to={svc.path}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', textDecoration: 'none', borderBottom: '1px solid var(--aws-border)', fontSize: 13 }}
                >
                  <AwsServiceIcon service={svc.name} size={22}/>
                  <span style={{ color: 'var(--aws-blue)' }}>{svc.label || svc.name}</span>
                </Link>
              ))}
            </div>
          </div>
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--aws-border)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <Link to="/">View all services</Link>
            <button className="aws-btn-link" style={{ fontSize: 13 }}>✎</button>
          </div>
        </div>

        {/* Cost and usage */}
        <div className="aws-widget">
          <div className="aws-widget-header">
            <DragHandle/> Cost and usage
            <span style={{ fontSize: 12, color: 'var(--aws-blue)', fontWeight: 400, marginLeft: 4 }}>Info</span>
            <WidgetMenu/>
          </div>
          <div className="aws-widget-content">
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--aws-text-secondary)', marginBottom: 4 }}>Month-to-date costs</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 30, fontWeight: 700 }}>$0.00</span>
                <span style={{ fontSize: 12, color: 'var(--aws-success)' }}>↓ $0.00 vs last month</span>
              </div>
            </div>
            <div style={{ height: 1, background: 'var(--aws-border)', margin: '12px 0' }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f2f8ef', borderRadius: 6, border: '1px solid #b7e1a1', marginBottom: 14 }}>
              <CheckCircle size={15} color="var(--aws-success)" style={{ flexShrink: 0 }}/>
              <span style={{ fontSize: 13 }}>No cost anomalies detected</span>
            </div>
            <div style={{ display: 'flex', gap: 0 }}>
              <div style={{ flex: 1, textAlign: 'center', paddingRight: 12, borderRight: '1px solid var(--aws-border)' }}>
                <div style={{ fontSize: 11, color: 'var(--aws-text-secondary)', marginBottom: 4 }}>Forecasted</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>$0.00</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', paddingLeft: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--aws-text-secondary)', marginBottom: 4 }}>Last month</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>$0.00</div>
              </div>
            </div>
          </div>
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--aws-border)', fontSize: 13 }}>
            <Link to="/">View all cost and usage</Link>
          </div>
        </div>

        {/* AWS Health */}
        <div className="aws-widget">
          <div className="aws-widget-header">
            <DragHandle/> AWS Health
            <span style={{ fontSize: 12, color: 'var(--aws-blue)', fontWeight: 400, marginLeft: 4 }}>Info</span>
            <WidgetMenu/>
          </div>
          <div className="aws-widget-content">
            {[
              { label: 'Open issues', value: 0, color: 'var(--aws-text-primary)', note: 'Past 7 days' },
              { label: 'Scheduled changes', value: 0, color: 'var(--aws-blue)', note: 'Upcoming + past 7 days' },
              { label: 'Other notifications', value: 0, color: 'var(--aws-text-primary)', note: 'Past 7 days' },
            ].map((item, i) => (
              <div key={item.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--aws-text-secondary)', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: item.color }}>{item.value}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--aws-text-secondary)', textAlign: 'right', maxWidth: 100 }}>{item.note}</span>
                </div>
                {i < 2 && <div style={{ height: 1, background: 'var(--aws-border)' }}/>}
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--aws-border)', fontSize: 13 }}>
            <Link to="/">View all events</Link>
          </div>
        </div>
      </div>

      {/* Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Welcome to AWS */}
        <div className="aws-widget">
          <div className="aws-widget-header">
            <DragHandle/> Welcome to AWS
            <WidgetMenu/>
          </div>
          <div className="aws-widget-content">
            <p style={{ fontSize: 13, color: 'var(--aws-text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
              AWS offers a broad set of global services including compute, storage, databases, analytics, networking, mobile, developer tools, management tools, IoT, security, and enterprise applications.
            </p>
            <button className="aws-btn aws-btn-primary" style={{ fontSize: 13 }}>
              Get started with AWS
            </button>
          </div>
        </div>

        {/* Trusted Advisor */}
        <div className="aws-widget">
          <div className="aws-widget-header">
            <DragHandle/> Trusted Advisor
            <WidgetMenu/>
          </div>
          <div className="aws-widget-content">
            <p style={{ fontSize: 13, color: 'var(--aws-text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
              Inspects your AWS environment and recommends best practices.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'Cost Optimizing', count: 0, color: 'var(--aws-success)' },
                { label: 'Performance', count: 0, color: 'var(--aws-blue)' },
                { label: 'Security', count: 0, color: 'var(--aws-error)' },
                { label: 'Fault Tolerance', count: 0, color: '#d08000' },
              ].map(cat => (
                <div key={cat.label} style={{ textAlign: 'center', padding: '10px 4px', border: '1px solid var(--aws-border-dark)', borderRadius: 6 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: cat.color }}>{cat.count}</div>
                  <div style={{ fontSize: 10, color: 'var(--aws-text-secondary)', lineHeight: 1.3, marginTop: 4 }}>{cat.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--aws-border)', fontSize: 13 }}>
            <Link to="/">View all checks</Link>
          </div>
        </div>

        {/* Build a solution */}
        <div className="aws-widget">
          <div className="aws-widget-header">
            <DragHandle/> Build a solution
            <WidgetMenu/>
          </div>
          <div className="aws-widget-content">
            <p style={{ fontSize: 13, color: 'var(--aws-text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
              Launch a virtual machine, store files, build a web app, and more.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { name: 'EC2',  label: 'Launch a virtual machine' },
                { name: 'S3',   label: 'Store files with Amazon S3', path: '/s3' },
                { name: 'RDS',  label: 'Launch a database' },
                { name: 'Lambda', label: 'Build a serverless function' },
              ].map(item => (
                <Link key={item.label} to={item.path || '/'} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--aws-border)', textDecoration: 'none' }}>
                  <AwsServiceIcon service={item.name} size={26}/>
                  <span style={{ color: 'var(--aws-blue)', fontSize: 13 }}>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Explore */}
      <div className="aws-widget">
        <div className="aws-widget-header">
          <DragHandle/> Explore the console
          <WidgetMenu/>
        </div>
        <div className="aws-widget-content">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              { icon: <BookOpen size={20} color="#ff9900"/>, title: 'Getting started', desc: 'Learn the basics of AWS services and how to navigate the console.' },
              { icon: <DollarSign size={20} color="var(--aws-success)"/>, title: 'Free Tier', desc: 'Explore services within Always Free, 12-Month Free, and Trial offers.' },
              { icon: <AlertCircle size={20} color="#d08000"/>, title: "What's new", desc: 'Stay up to date with the latest AWS announcements and new services.' },
            ].map(card => (
              <div key={card.title} style={{ display: 'flex', gap: 12, padding: 14, border: '1px solid var(--aws-border-dark)', borderRadius: 8, cursor: 'pointer' }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>{card.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--aws-blue)', marginBottom: 4 }}>{card.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--aws-text-secondary)', lineHeight: 1.5 }}>{card.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
