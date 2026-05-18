/**
 * AWS Service Icon components — SVG approximations of the official AWS
 * Architecture Icons. Same category colors, same geometric shapes.
 *
 * Usage:
 *   <AwsServiceIcon service="S3" size={32} />
 */

const COLORS = {
  compute:     '#E07B00',
  storage:     '#3F8624',
  database:    '#4053B6',
  networking:  '#8C4FFF',
  security:    '#DD344C',
  management:  '#E7157B',
  integration: '#E7157B',
  analytics:   '#8C4FFF',
  container:   '#E07B00',
  billing:     '#E07B00',
  general:     '#687078',
};

/* ── Individual icon paths (80×80 internal viewBox) ─────────────────── */

const icons = {

  /* Storage ─────────────────────────────────────────────────────── */
  S3: {
    color: COLORS.storage,
    render: () => (
      <>
        {/* Bottom arc of bucket */}
        <ellipse cx="40" cy="58" rx="22" ry="7" fill="white" opacity="0.95"/>
        {/* Bucket walls */}
        <path d="M18 30 L18 58 Q18 66 40 66 Q62 66 62 58 L62 30" fill="white" opacity="0.95"/>
        {/* Bucket top rim (lid) */}
        <ellipse cx="40" cy="30" rx="22" ry="7" fill="white"/>
        {/* Inner highlight line */}
        <ellipse cx="40" cy="30" rx="13" ry="4" fill="none" stroke="#3F8624" strokeWidth="1.5" opacity="0.6"/>
      </>
    ),
  },

  /* Compute ─────────────────────────────────────────────────────── */
  EC2: {
    color: COLORS.compute,
    render: () => (
      <>
        {/* Server frame */}
        <rect x="14" y="18" width="52" height="44" rx="3" fill="white" opacity="0.95"/>
        {/* Top slot row */}
        <rect x="20" y="24" width="38" height="5" rx="1.5" fill="#E07B00" opacity="0.7"/>
        {/* Middle slot row */}
        <rect x="20" y="34" width="38" height="5" rx="1.5" fill="#E07B00" opacity="0.7"/>
        {/* Bottom slot row */}
        <rect x="20" y="44" width="38" height="5" rx="1.5" fill="#E07B00" opacity="0.7"/>
        {/* Status LEDs */}
        <circle cx="24" cy="56" r="2.5" fill="#E07B00" opacity="0.8"/>
        <circle cx="31" cy="56" r="2.5" fill="#E07B00" opacity="0.8"/>
      </>
    ),
  },

  Lambda: {
    color: COLORS.compute,
    render: () => (
      <>
        {/* Lambda λ symbol */}
        <text
          x="40" y="58"
          fontSize="46" fontWeight="900"
          fontFamily="'Times New Roman', Georgia, serif"
          fill="white" textAnchor="middle"
          style={{ userSelect: 'none' }}
        >λ</text>
      </>
    ),
  },

  Beanstalk: {
    color: COLORS.storage,
    render: () => (
      <>
        {/* Leaf / plant symbol representing Elastic Beanstalk */}
        <path
          d="M40 65 C40 65 18 55 18 35 C18 25 28 18 40 22 C52 18 62 25 62 35 C62 55 40 65 40 65 Z"
          fill="white" opacity="0.95"
        />
        <path
          d="M40 65 C40 65 40 45 40 30"
          stroke="#3F8624" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.7"
        />
        <path
          d="M40 48 C36 42 26 40 22 38"
          stroke="#3F8624" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6"
        />
      </>
    ),
  },

  /* Serverless ──────────────────────────────────────────────────── */
  StepFunctions: {
    color: COLORS.integration,
    render: () => (
      <>
        {/* State machine / workflow boxes connected by lines */}
        <rect x="28" y="14" width="24" height="14" rx="3" fill="white" opacity="0.9"/>
        <rect x="28" y="33" width="24" height="14" rx="3" fill="white" opacity="0.9"/>
        <rect x="28" y="52" width="24" height="14" rx="3" fill="white" opacity="0.9"/>
        <line x1="40" y1="28" x2="40" y2="33" stroke="white" strokeWidth="2.5" opacity="0.8"/>
        <line x1="40" y1="47" x2="40" y2="52" stroke="white" strokeWidth="2.5" opacity="0.8"/>
      </>
    ),
  },

  EventBridge: {
    color: COLORS.integration,
    render: () => (
      <>
        {/* Bus / event routing — horizontal bar with vertical branches */}
        <rect x="14" y="37" width="52" height="6" rx="3" fill="white" opacity="0.95"/>
        <line x1="25" y1="37" x2="25" y2="22" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.9"/>
        <line x1="40" y1="37" x2="40" y2="18" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.9"/>
        <line x1="55" y1="37" x2="55" y2="22" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.9"/>
        <line x1="25" y1="43" x2="25" y2="58" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.9"/>
        <line x1="55" y1="43" x2="55" y2="58" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.9"/>
        <circle cx="25" cy="22" r="4" fill="white" opacity="0.9"/>
        <circle cx="40" cy="18" r="4" fill="white" opacity="0.9"/>
        <circle cx="55" cy="22" r="4" fill="white" opacity="0.9"/>
        <circle cx="25" cy="58" r="4" fill="white" opacity="0.9"/>
        <circle cx="55" cy="58" r="4" fill="white" opacity="0.9"/>
      </>
    ),
  },

  /* Database ────────────────────────────────────────────────────── */
  DynamoDB: {
    color: COLORS.database,
    render: () => (
      <>
        {/* Three stacked database cylinders */}
        <ellipse cx="40" cy="20" rx="20" ry="6" fill="white" opacity="0.95"/>
        <rect x="20" y="20" width="40" height="12" fill="white" opacity="0.95"/>
        <ellipse cx="40" cy="32" rx="20" ry="6" fill="white" opacity="0.95"/>
        <ellipse cx="40" cy="44" rx="20" ry="6" fill="white" opacity="0.7"/>
        <rect x="20" y="44" width="40" height="12" fill="white" opacity="0.7"/>
        <ellipse cx="40" cy="56" rx="20" ry="6" fill="white" opacity="0.7"/>
        {/* Lightning bolt overlay */}
        <path d="M44 18 L36 38 L42 38 L38 58 L47 32 L41 32 Z"
          fill="#4053B6" opacity="0.55"/>
      </>
    ),
  },

  RDS: {
    color: COLORS.database,
    render: () => (
      <>
        {/* Single database cylinder */}
        <ellipse cx="40" cy="24" rx="22" ry="8" fill="white" opacity="0.95"/>
        <rect x="18" y="24" width="44" height="28" fill="white" opacity="0.95"/>
        <ellipse cx="40" cy="52" rx="22" ry="8" fill="white" opacity="0.95"/>
        {/* Horizontal stripe lines */}
        <line x1="18" y1="34" x2="62" y2="34" stroke="#4053B6" strokeWidth="1.5" opacity="0.4"/>
        <line x1="18" y1="42" x2="62" y2="42" stroke="#4053B6" strokeWidth="1.5" opacity="0.4"/>
      </>
    ),
  },

  /* Security ────────────────────────────────────────────────────── */
  IAM: {
    color: COLORS.security,
    render: () => (
      <>
        {/* Person silhouette */}
        <circle cx="40" cy="28" r="12" fill="white" opacity="0.95"/>
        {/* Body/torso */}
        <path d="M18 68 C18 50 62 50 62 68" fill="white" opacity="0.95"/>
        {/* Key/access symbol overlay at bottom-right */}
        <circle cx="57" cy="57" r="8" fill="#DD344C" opacity="0.85"/>
        <circle cx="57" cy="57" r="4" fill="white" opacity="0.95"/>
        <rect x="57" y="57" width="8" height="3" rx="1" fill="white" opacity="0.95"/>
        <rect x="62" y="60" width="3" height="2" rx="0.5" fill="white" opacity="0.95"/>
      </>
    ),
  },

  /* Management ──────────────────────────────────────────────────── */
  CloudWatch: {
    color: COLORS.management,
    render: () => (
      <>
        {/* Gauge / dial background */}
        <circle cx="40" cy="40" r="26" fill="white" opacity="0.95"/>
        {/* Gauge arc (top half) */}
        <path
          d="M 16 44 A 24 24 0 0 1 64 44"
          fill="none" stroke="#E7157B" strokeWidth="5" strokeLinecap="round" opacity="0.7"
        />
        {/* Alarm/bell ticks */}
        <line x1="40" y1="18" x2="40" y2="24" stroke="#E7157B" strokeWidth="3" strokeLinecap="round" opacity="0.6"/>
        <line x1="20" y1="28" x2="24" y2="32" stroke="#E7157B" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
        <line x1="60" y1="28" x2="56" y2="32" stroke="#E7157B" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
        {/* Needle */}
        <line x1="40" y1="40" x2="28" y2="28" stroke="#E7157B" strokeWidth="3" strokeLinecap="round" opacity="0.9"/>
        <circle cx="40" cy="40" r="3.5" fill="#E7157B" opacity="0.9"/>
      </>
    ),
  },

  /* Networking ──────────────────────────────────────────────────── */
  VPC: {
    color: COLORS.networking,
    render: () => (
      <>
        {/* Shield outline */}
        <path
          d="M40 14 L62 24 L62 44 C62 56 52 63 40 67 C28 63 18 56 18 44 L18 24 Z"
          fill="white" opacity="0.95"
        />
        {/* Globe/grid lines inside shield */}
        <circle cx="40" cy="42" r="14" fill="none" stroke="#8C4FFF" strokeWidth="2" opacity="0.5"/>
        <line x1="40" y1="28" x2="40" y2="56" stroke="#8C4FFF" strokeWidth="1.5" opacity="0.5"/>
        <line x1="26" y1="42" x2="54" y2="42" stroke="#8C4FFF" strokeWidth="1.5" opacity="0.5"/>
        <path d="M32 30 Q40 42 32 54" fill="none" stroke="#8C4FFF" strokeWidth="1.5" opacity="0.4"/>
        <path d="M48 30 Q40 42 48 54" fill="none" stroke="#8C4FFF" strokeWidth="1.5" opacity="0.4"/>
      </>
    ),
  },

  Route53: {
    color: COLORS.networking,
    render: () => (
      <>
        {/* Globe */}
        <circle cx="40" cy="40" r="26" fill="white" opacity="0.95"/>
        {/* Globe grid */}
        <ellipse cx="40" cy="40" rx="14" ry="26" fill="none" stroke="#8C4FFF" strokeWidth="2" opacity="0.5"/>
        <line x1="14" y1="40" x2="66" y2="40" stroke="#8C4FFF" strokeWidth="2" opacity="0.5"/>
        <ellipse cx="40" cy="40" rx="26" ry="10" fill="none" stroke="#8C4FFF" strokeWidth="1.5" opacity="0.4"/>
        {/* DNS arrow */}
        <path d="M28 30 L52 30 L52 26 L60 32 L52 38 L52 34 L28 34 Z"
          fill="#8C4FFF" opacity="0.6"/>
      </>
    ),
  },

  /* Container ───────────────────────────────────────────────────── */
  ECS: {
    color: COLORS.container,
    render: () => (
      <>
        {/* 2x2 container grid */}
        <rect x="14" y="14" width="23" height="23" rx="3" fill="white" opacity="0.95"/>
        <rect x="43" y="14" width="23" height="23" rx="3" fill="white" opacity="0.95"/>
        <rect x="14" y="43" width="23" height="23" rx="3" fill="white" opacity="0.95"/>
        <rect x="43" y="43" width="23" height="23" rx="3" fill="white" opacity="0.95"/>
        {/* Lines inside containers (representing data/layers) */}
        <line x1="19" y1="22" x2="32" y2="22" stroke="#E07B00" strokeWidth="2" opacity="0.6"/>
        <line x1="19" y1="27" x2="32" y2="27" stroke="#E07B00" strokeWidth="2" opacity="0.6"/>
        <line x1="48" y1="22" x2="61" y2="22" stroke="#E07B00" strokeWidth="2" opacity="0.6"/>
        <line x1="48" y1="27" x2="61" y2="27" stroke="#E07B00" strokeWidth="2" opacity="0.6"/>
        <line x1="19" y1="51" x2="32" y2="51" stroke="#E07B00" strokeWidth="2" opacity="0.6"/>
        <line x1="19" y1="56" x2="32" y2="56" stroke="#E07B00" strokeWidth="2" opacity="0.6"/>
        <line x1="48" y1="51" x2="61" y2="51" stroke="#E07B00" strokeWidth="2" opacity="0.6"/>
        <line x1="48" y1="56" x2="61" y2="56" stroke="#E07B00" strokeWidth="2" opacity="0.6"/>
      </>
    ),
  },

  ECR: {
    color: COLORS.container,
    render: () => (
      <>
        {/* Container with magnify / registry symbol */}
        <rect x="14" y="18" width="36" height="44" rx="3" fill="white" opacity="0.95"/>
        <line x1="20" y1="28" x2="44" y2="28" stroke="#E07B00" strokeWidth="2.5" opacity="0.6"/>
        <line x1="20" y1="36" x2="44" y2="36" stroke="#E07B00" strokeWidth="2.5" opacity="0.6"/>
        <line x1="20" y1="44" x2="44" y2="44" stroke="#E07B00" strokeWidth="2.5" opacity="0.6"/>
        {/* Magnifying glass */}
        <circle cx="56" cy="54" r="12" fill="none" stroke="white" strokeWidth="4" opacity="0.95"/>
        <line x1="64" y1="62" x2="70" y2="68" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.95"/>
      </>
    ),
  },

  /* Analytics ───────────────────────────────────────────────────── */
  Athena: {
    color: COLORS.analytics,
    render: () => (
      <>
        {/* Query / database with magnify */}
        <ellipse cx="40" cy="28" rx="22" ry="8" fill="white" opacity="0.95"/>
        <rect x="18" y="28" width="44" height="18" fill="white" opacity="0.95"/>
        <ellipse cx="40" cy="46" rx="22" ry="8" fill="white" opacity="0.95"/>
        {/* Search/query indicator */}
        <circle cx="40" cy="58" r="9" fill="none" stroke="white" strokeWidth="3.5" opacity="0.95"/>
        <line x1="46" y1="64" x2="53" y2="71" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.95"/>
      </>
    ),
  },

  /* Billing ─────────────────────────────────────────────────────── */
  Billing: {
    color: COLORS.billing,
    render: () => (
      <>
        {/* Dollar sign */}
        <text x="40" y="56" fontSize="50" fontWeight="900"
          fontFamily="Arial, sans-serif" fill="white" textAnchor="middle"
          style={{ userSelect: 'none' }}>$</text>
      </>
    ),
  },
};

/* ── Wrapper component ─────────────────────────────────────────────── */

/**
 * @param {string}  service  - Service name key (e.g. "S3", "EC2", "Lambda")
 * @param {number}  size     - Outer square size in px (default 32)
 * @param {number}  radius   - Corner radius (default 20% of size)
 */
export function AwsServiceIcon({ service, size = 32, radius }) {
  const def = icons[service];
  if (!def) {
    // Fallback: colored square with abbreviation
    const bg = COLORS.general;
    const r = radius ?? Math.round(size * 0.18);
    return (
      <svg width={size} height={size} viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, display: 'block' }}>
        <rect x="0" y="0" width="80" height="80" rx={r * (80 / size)} fill={bg}/>
        <text x="40" y="52" fontSize="28" fontWeight="800"
          fontFamily="'Amazon Ember',Arial,sans-serif" fill="white" textAnchor="middle">
          {service.slice(0, 2).toUpperCase()}
        </text>
      </svg>
    );
  }

  const r = radius ?? Math.round(size * 0.18);
  const rViewBox = r * (80 / size); // scale radius to 80px viewBox

  return (
    <svg
      width={size} height={size}
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <rect x="0" y="0" width="80" height="80" rx={rViewBox} fill={def.color}/>
      {def.render()}
    </svg>
  );
}

export default AwsServiceIcon;
