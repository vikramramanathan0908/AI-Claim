import { Link } from "react-router-dom";
import "./Landing.css";

const FEATURES = [
  {
    title: "EDI 837 Parsing",
    desc: "Ingests raw X12 837 claim files and structures every segment — patient, provider, diagnoses, procedures, and charges — into clean JSON.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></svg>
    ),
  },
  {
    title: "PHI Tokenization",
    desc: "Patient names and addresses are masked into reversible tokens before any data reaches a model. Re-identification stays server-side only.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
    ),
  },
  {
    title: "RAG Rules Engine",
    desc: "Adjudication, benefit, clinical, and fee-schedule rules are embedded into a pgvector store and retrieved per-claim for grounded decisions.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18" /><path d="m8 7-4 4 4 4" /><path d="m16 7 4 4-4 4" /></svg>
    ),
  },
  {
    title: "Multi-Agent Pipeline",
    desc: "Specialized intake, decision, and payment agents run on a LangGraph state machine — each step auditable and independently inspectable.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="19" r="2.5" /><circle cx="19" cy="19" r="2.5" /><path d="M12 7.5v4M10 13l-3.5 4M14 13l3.5 4" /></svg>
    ),
  },
  {
    title: "Human-in-the-Loop",
    desc: "High-dollar or ambiguous claims pause the graph and surface an AI summary for a human to approve or deny — then resume exactly where they left off.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m17 11 2 2 4-4" /></svg>
    ),
  },
  {
    title: "Output Guardrails",
    desc: "Every model response is scanned for leaked PHI and policy violations before it's surfaced, with alerts raised on any detection.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>
    ),
  },
];

const STEPS = [
  { n: "01", title: "Parse & Structure", desc: "Raw EDI is decoded into a normalized claim object." },
  { n: "02", title: "Mask PHI", desc: "Identifiers are tokenized before any AI processing." },
  { n: "03", title: "Retrieve Rules", desc: "Relevant policy chunks are pulled from the vector store." },
  { n: "04", title: "Agents Adjudicate", desc: "Intake → Decision → Payment agents reason over the claim." },
  { n: "05", title: "Decide & Pay", desc: "Approve, deny, or escalate — with a full audit trail." },
];

const STATS = [
  { value: "60s", label: "Average decision time" },
  { value: "30 days", label: "Replaced manual cycle" },
  { value: "8", label: "Automated intake checks" },
  { value: "100%", label: "PHI masked pre-inference" },
];

export default function Landing() {
  return (
    <div className="landing">
      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            AI-Powered Claims Adjudication
          </div>
          <h1 className="hero-title">
            Settle medical claims in
            <span className="hero-title-grad"> seconds, not weeks.</span>
          </h1>
          <p className="hero-sub">
            ClaimIQ turns a 30-day manual adjudication process into a 60-second autonomous workflow —
            parsing EDI, masking PHI, retrieving policy rules, and running a multi-agent pipeline that
            approves, denies, or escalates every claim with a complete audit trail.
          </p>
          <div className="hero-actions">
            <Link to="/app" className="btn-primary">
              Launch the Console
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
            <a href="#workflow" className="btn-secondary">See how it works</a>
          </div>
          <div className="hero-trust">
            <span>HIPAA-aware</span>
            <span className="hero-trust-dot" />
            <span>Auditable by design</span>
            <span className="hero-trust-dot" />
            <span>Human-in-the-loop</span>
          </div>
        </div>

        {/* Pipeline visual */}
        <div className="hero-visual">
          <div className="pipe-card">
            <div className="pipe-card-head">
              <span className="pipe-dot pipe-dot-r" />
              <span className="pipe-dot pipe-dot-y" />
              <span className="pipe-dot pipe-dot-g" />
              <span className="pipe-card-title">claim_clean.edi</span>
            </div>
            <div className="pipe-stages">
              {[
                { label: "EDI Parsed", tone: "blue", meta: "28 segments" },
                { label: "PHI Masked", tone: "teal", meta: "6 tokens" },
                { label: "Rules Retrieved", tone: "violet", meta: "4 chunks" },
                { label: "Intake Review", tone: "blue", meta: "8/8 passed" },
                { label: "Decision", tone: "violet", meta: "APPROVED" },
                { label: "Payment", tone: "teal", meta: "EOB generated" },
              ].map((s, i) => (
                <div className={`pipe-stage tone-${s.tone}`} key={s.label} style={{ animationDelay: `${i * 0.12}s` }}>
                  <span className="pipe-stage-check">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
                  </span>
                  <span className="pipe-stage-label">{s.label}</span>
                  <span className="pipe-stage-meta">{s.meta}</span>
                </div>
              ))}
            </div>
            <div className="pipe-card-foot">
              <span className="pipe-result">APPROVED</span>
              <span className="pipe-time">13.2s end-to-end</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="stats">
        {STATS.map((s) => (
          <div className="stat" key={s.label}>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Dashboard CTA ── */}
      <section className="section" id="dashboard">
        <div className="section-head">
          <div className="section-eyebrow">Operations</div>
          <h2 className="section-title">A live view of every claim, in real time.</h2>
          <p className="section-desc">
            Track adjudication volume, approval and denial rates, payouts, and pipeline performance —
            all from a single operational dashboard.
          </p>
        </div>
        <div className="section-cta">
          <Link to="/dashboard" className="btn-primary btn-lg">
            Open the Dashboard
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="section" id="features">
        <div className="section-head">
          <div className="section-eyebrow">Capabilities</div>
          <h2 className="section-title">Everything a claims team does — automated end to end.</h2>
          <p className="section-desc">
            Six purpose-built stages work together to take a raw claim file from inbox to adjudicated decision,
            without ever exposing protected health information to a model.
          </p>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Workflow ── */}
      <section className="section" id="workflow">
        <div className="section-head">
          <div className="section-eyebrow">The Pipeline</div>
          <h2 className="section-title">From EDI file to decision in five steps.</h2>
          <p className="section-desc">
            A deterministic LangGraph state machine orchestrates every claim, so each decision is reproducible and traceable.
          </p>
        </div>
        <div className="workflow">
          {STEPS.map((s, i) => (
            <div className="workflow-step" key={s.n}>
              <div className="workflow-num">{s.n}</div>
              <div className="workflow-body">
                <h3 className="workflow-title">{s.title}</h3>
                <p className="workflow-desc">{s.desc}</p>
              </div>
              {i < STEPS.length - 1 && <div className="workflow-connector" />}
            </div>
          ))}
        </div>
      </section>

      {/* ── Security ── */}
      <section className="section security" id="security">
        <div className="security-inner">
          <div className="security-copy">
            <div className="section-eyebrow">Security &amp; Compliance</div>
            <h2 className="section-title">PHI never reaches the model in the clear.</h2>
            <p className="section-desc">
              Protected health information is tokenized before inference and re-identified only on trusted
              infrastructure. Every claim produces an auditable trail of what each agent saw and decided.
            </p>
            <ul className="security-list">
              <li><span className="sec-check" />Reversible PHI tokenization, server-side key only</li>
              <li><span className="sec-check" />Output guardrails scan for leaked identifiers</li>
              <li><span className="sec-check" />Deterministic, replayable decision graph</li>
              <li><span className="sec-check" />Human approval gate for high-risk claims</li>
            </ul>
          </div>
          <div className="security-panel">
            <div className="sec-row">
              <span className="sec-row-label">Patient</span>
              <span className="sec-row-before">JOHN SMITH</span>
              <svg className="sec-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              <span className="sec-row-after">[PATIENT_001]</span>
            </div>
            <div className="sec-row">
              <span className="sec-row-label">Address</span>
              <span className="sec-row-before">742 Evergreen Terr.</span>
              <svg className="sec-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              <span className="sec-row-after">[ADDR_001]</span>
            </div>
            <div className="sec-row">
              <span className="sec-row-label">Provider</span>
              <span className="sec-row-before">Dr. R. Johnson</span>
              <svg className="sec-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              <span className="sec-row-after">[PROVIDER_001]</span>
            </div>
            <div className="sec-panel-foot">
              <span className="phi-pill">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                Masked before inference
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta">
        <div className="cta-inner">
          <h2 className="cta-title">See a claim adjudicated in real time.</h2>
          <p className="cta-desc">
            Open the live console, pick a sample claim or upload your own EDI file, and watch the
            pipeline reason its way to a decision.
          </p>
          <Link to="/app" className="btn-primary btn-lg">
            Launch the Console
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
