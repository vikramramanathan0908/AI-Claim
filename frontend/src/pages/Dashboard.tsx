import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./Dashboard.css";

/* ─────────────────────────────────────────────────────────────
   Mock analytics data. In a real deployment these numbers would
   come from the backend (aggregated over processed claims).
   ───────────────────────────────────────────────────────────── */

type Range = "7d" | "30d" | "90d";

const RANGE_DATA: Record<
  Range,
  {
    total: number;
    approved: number;
    denied: number;
    review: number;
    fraud: number;
    payout: number;
    avgSeconds: number;
    autoRate: number;
    deltas: { total: number; approved: number; denied: number; review: number };
    volume: { label: string; approved: number; denied: number; review: number }[];
  }
> = {
  "7d": {
    total: 1284,
    approved: 968,
    denied: 213,
    review: 103,
    fraud: 17,
    payout: 1_842_500,
    avgSeconds: 11.4,
    autoRate: 92,
    deltas: { total: 8.2, approved: 6.1, denied: -3.4, review: 2.0 },
    volume: [
      { label: "Mon", approved: 121, denied: 28, review: 14 },
      { label: "Tue", approved: 142, denied: 31, review: 16 },
      { label: "Wed", approved: 138, denied: 24, review: 12 },
      { label: "Thu", approved: 156, denied: 35, review: 19 },
      { label: "Fri", approved: 149, denied: 30, review: 15 },
      { label: "Sat", approved: 132, denied: 33, review: 18 },
      { label: "Sun", approved: 130, denied: 32, review: 9 },
    ],
  },
  "30d": {
    total: 5476,
    approved: 4128,
    denied: 902,
    review: 446,
    fraud: 64,
    payout: 7_915_300,
    avgSeconds: 12.1,
    autoRate: 91,
    deltas: { total: 12.6, approved: 9.4, denied: -2.1, review: 4.8 },
    volume: [
      { label: "W1", approved: 982, denied: 214, review: 102 },
      { label: "W2", approved: 1024, denied: 236, review: 118 },
      { label: "W3", approved: 1056, denied: 221, review: 109 },
      { label: "W4", approved: 1066, denied: 231, review: 117 },
    ],
  },
  "90d": {
    total: 16_842,
    approved: 12_640,
    denied: 2_812,
    review: 1_390,
    fraud: 198,
    payout: 23_476_900,
    avgSeconds: 12.8,
    autoRate: 90,
    deltas: { total: 18.9, approved: 14.2, denied: 1.6, review: 6.3 },
    volume: [
      { label: "Apr", approved: 4012, denied: 902, review: 441 },
      { label: "May", approved: 4231, denied: 948, review: 472 },
      { label: "Jun", approved: 4397, denied: 962, review: 477 },
    ],
  },
};

const PAYER_MIX = [
  { name: "Blue Cross Blue Shield", share: 31, claims: 1697 },
  { name: "UnitedHealthcare", share: 24, claims: 1314 },
  { name: "Aetna", share: 18, claims: 985 },
  { name: "Cigna", share: 14, claims: 766 },
  { name: "Medicare", share: 13, claims: 714 },
];

const RECENT_CLAIMS = [
  { id: "CLM-48213", patient: "[PATIENT_204]", payer: "Aetna", amount: 4820, status: "Approved", time: "2m ago" },
  { id: "CLM-48212", patient: "[PATIENT_198]", payer: "UnitedHealthcare", amount: 12450, status: "Review", time: "6m ago" },
  { id: "CLM-48211", patient: "[PATIENT_191]", payer: "Cigna", amount: 980, status: "Approved", time: "9m ago" },
  { id: "CLM-48210", patient: "[PATIENT_187]", payer: "Medicare", amount: 7310, status: "Denied", time: "14m ago" },
  { id: "CLM-48209", patient: "[PATIENT_180]", payer: "Blue Cross Blue Shield", amount: 2560, status: "Approved", time: "21m ago" },
  { id: "CLM-48208", patient: "[PATIENT_176]", payer: "Aetna", amount: 18900, status: "Review", time: "27m ago" },
  { id: "CLM-48207", patient: "[PATIENT_171]", payer: "UnitedHealthcare", amount: 640, status: "Approved", time: "33m ago" },
  { id: "CLM-48206", patient: "[PATIENT_165]", payer: "Cigna", amount: 3450, status: "Denied", time: "41m ago" },
];

const usd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${n.toLocaleString()}`;

const num = (n: number) => n.toLocaleString();

function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const up = value > 0;
  return (
    <span className={`kpi-delta ${positive ? "is-up" : "is-down"}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {up ? <path d="M7 17 17 7M9 7h8v8" /> : <path d="M7 7l10 10M9 17h8V9" />}
      </svg>
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

/* ── Donut chart (pure SVG) ── */
function Donut({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" className="donut">
        <circle cx="70" cy="70" r={r} className="donut-track" />
        {segments.map((s) => {
          const len = (s.value / total) * c;
          const dash = `${len} ${c - len}`;
          const el = (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={r}
              className="donut-seg"
              stroke={s.color}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
        <text x="70" y="64" className="donut-center-num">{num(total)}</text>
        <text x="70" y="84" className="donut-center-label">claims</text>
      </svg>
      <div className="donut-legend">
        {segments.map((s) => (
          <div className="donut-legend-row" key={s.label}>
            <span className="donut-dot" style={{ background: s.color }} />
            <span className="donut-legend-label">{s.label}</span>
            <span className="donut-legend-val">
              {num(s.value)} · {Math.round((s.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Stacked volume bar chart (pure SVG) ── */
function VolumeChart({
  data,
}: {
  data: { label: string; approved: number; denied: number; review: number }[];
}) {
  const max = Math.max(...data.map((d) => d.approved + d.denied + d.review));
  const W = 560;
  const H = 220;
  const pad = { t: 16, r: 8, b: 28, l: 8 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const slot = innerW / data.length;
  const barW = Math.min(46, slot * 0.5);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="vol-chart" preserveAspectRatio="none">
      {[0, 0.25, 0.5, 0.75, 1].map((g) => {
        const y = pad.t + innerH * g;
        return <line key={g} x1={pad.l} y1={y} x2={W - pad.r} y2={y} className="vol-grid" />;
      })}
      {data.map((d, i) => {
        const x = pad.l + slot * i + slot / 2 - barW / 2;
        const stack = [
          { v: d.approved, c: "url(#gApproved)" },
          { v: d.review, c: "url(#gReview)" },
          { v: d.denied, c: "url(#gDenied)" },
        ];
        let yCursor = pad.t + innerH;
        return (
          <g key={d.label}>
            {stack.map((s, j) => {
              const h = (s.v / max) * innerH;
              yCursor -= h;
              return (
                <rect
                  key={j}
                  x={x}
                  y={yCursor}
                  width={barW}
                  height={Math.max(0, h - 1.5)}
                  rx={3}
                  fill={s.c}
                  className="vol-bar"
                />
              );
            })}
            <text x={pad.l + slot * i + slot / 2} y={H - 8} className="vol-label">
              {d.label}
            </text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="gApproved" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
        <linearGradient id="gReview" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="gDenied" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Dashboard({ embedded = false }: { embedded?: boolean }) {
  const [range, setRange] = useState<Range>("7d");
  const d = RANGE_DATA[range];

  const kpis = useMemo(
    () => [
      {
        label: "Total Claims",
        value: num(d.total),
        delta: d.deltas.total,
        tone: "blue",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></svg>
        ),
      },
      {
        label: "Approved",
        value: num(d.approved),
        delta: d.deltas.approved,
        tone: "teal",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
        ),
      },
      {
        label: "Denied",
        value: num(d.denied),
        delta: d.deltas.denied,
        invert: true,
        tone: "red",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" /></svg>
        ),
      },
      {
        label: "Needs Review",
        value: num(d.review),
        delta: d.deltas.review,
        invert: true,
        tone: "amber",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /></svg>
        ),
      },
    ],
    [d]
  );

  const secondary = [
    { label: "Auto-adjudication rate", value: `${d.autoRate}%`, hint: "No human touch" },
    { label: "Total paid out", value: usd(d.payout), hint: "Approved EOBs" },
    { label: "Avg decision time", value: `${d.avgSeconds.toFixed(1)}s`, hint: "End to end" },
    { label: "Fraud flagged", value: num(d.fraud), hint: "Guardrail alerts" },
  ];

  const statusBadge = (s: string) =>
    s === "Approved" ? "sb-approved" : s === "Denied" ? "sb-denied" : "sb-review";

  return (
    <div className={`dashboard ${embedded ? "is-embedded" : ""}`}>
      {/* Header */}
      <div className="dash-head">
        {embedded ? (
          <div className="dash-head-spacer" />
        ) : (
          <div>
            <div className="section-eyebrow">Operations</div>
            <h1 className="dash-title">Claims Dashboard</h1>
            <p className="dash-sub">
              Live overview of adjudication volume, outcomes, and pipeline performance.
            </p>
          </div>
        )}
        <div className="dash-controls">
          <div className="range-toggle">
            {(["7d", "30d", "90d"] as Range[]).map((r) => (
              <button
                key={r}
                className={`range-btn ${range === r ? "is-active" : ""}`}
                onClick={() => setRange(r)}
              >
                {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
              </button>
            ))}
          </div>
          <Link to="/app" className="dash-cta">
            Open Console
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid">
        {kpis.map((k) => (
          <div className={`kpi-card tone-${k.tone}`} key={k.label}>
            <div className="kpi-top">
              <span className="kpi-icon">{k.icon}</span>
              <Delta value={k.delta} invert={k.invert} />
            </div>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="chart-row">
        <div className="panel chart-volume">
          <div className="panel-head">
            <div>
              <h3 className="panel-title">Claim volume by outcome</h3>
              <p className="panel-sub">Stacked daily totals over the selected period</p>
            </div>
            <div className="legend">
              <span className="legend-item"><span className="legend-swatch sw-teal" />Approved</span>
              <span className="legend-item"><span className="legend-swatch sw-amber" />Review</span>
              <span className="legend-item"><span className="legend-swatch sw-red" />Denied</span>
            </div>
          </div>
          <VolumeChart data={d.volume} />
        </div>

        <div className="panel chart-donut">
          <div className="panel-head">
            <h3 className="panel-title">Outcome split</h3>
          </div>
          <Donut
            segments={[
              { value: d.approved, color: "#2dd4bf", label: "Approved" },
              { value: d.review, color: "#f59e0b", label: "Needs review" },
              { value: d.denied, color: "#ef4444", label: "Denied" },
            ]}
          />
        </div>
      </div>

      {/* Secondary stats */}
      <div className="mini-grid">
        {secondary.map((s) => (
          <div className="mini-card" key={s.label}>
            <div className="mini-value">{s.value}</div>
            <div className="mini-label">{s.label}</div>
            <div className="mini-hint">{s.hint}</div>
          </div>
        ))}
      </div>

      {/* Bottom row: payer mix + recent claims */}
      <div className="bottom-row">
        <div className="panel payer-panel">
          <div className="panel-head">
            <h3 className="panel-title">Top payers by volume</h3>
          </div>
          <div className="payer-list">
            {PAYER_MIX.map((p) => (
              <div className="payer-row" key={p.name}>
                <div className="payer-meta">
                  <span className="payer-name">{p.name}</span>
                  <span className="payer-claims">{num(p.claims)} claims</span>
                </div>
                <div className="payer-bar-track">
                  <div className="payer-bar-fill" style={{ width: `${p.share}%` }} />
                </div>
                <span className="payer-share">{p.share}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel recent-panel">
          <div className="panel-head">
            <h3 className="panel-title">Recent activity</h3>
            <span className="live-pill"><span className="live-dot" />Live</span>
          </div>
          <div className="table-wrap">
            <table className="claims-table">
              <thead>
                <tr>
                  <th>Claim</th>
                  <th>Patient</th>
                  <th>Payer</th>
                  <th className="ta-right">Amount</th>
                  <th>Status</th>
                  <th className="ta-right">When</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_CLAIMS.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{c.id}</td>
                    <td className="mono dim">{c.patient}</td>
                    <td>{c.payer}</td>
                    <td className="ta-right mono">${num(c.amount)}</td>
                    <td>
                      <span className={`status-badge ${statusBadge(c.status)}`}>{c.status}</span>
                    </td>
                    <td className="ta-right dim">{c.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="dash-disclaimer">
        Figures shown are illustrative sample data for demonstration purposes.
      </p>
    </div>
  );
}
