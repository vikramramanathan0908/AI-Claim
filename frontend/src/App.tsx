import { useState, useRef, useCallback } from "react";
import "./App.css";
import { CLAIM_FILES, getRawEdi } from "./lib/claimData";
import type { ParsedClaim } from "./lib/ediParser";
import {
  type ProcessingState,
  processClaim,
  processHumanDecision,
} from "./lib/claimProcessor";

interface Session {
  processingState: ProcessingState;
  parsedClaim: ParsedClaim | null;
  maskedClaim: Record<string, unknown> | null;
  tokenMap: Record<string, string>;
  intakeOutput: string;
  decisionOutput: string;
  decision: string;
  paymentOutput: string;
  finalStatus: string;
  processingSeconds: number;
  guardrailWarnings: string[];
  stage: string;
  threadId?: string;
}

const INITIAL_SESSION: Session = {
  processingState: "idle",
  parsedClaim: null,
  maskedClaim: null,
  tokenMap: {},
  intakeOutput: "",
  decisionOutput: "",
  decision: "",
  paymentOutput: "",
  finalStatus: "PENDING",
  processingSeconds: 0,
  guardrailWarnings: [],
  stage: "",
};

function StatusBadge({ state, finalStatus }: { state: ProcessingState; finalStatus: string }) {
  if (state === "idle") return <span className="badge badge-idle">IDLE</span>;
  if (state === "running")
    return (
      <span className="badge badge-processing">
        PROCESSING<span className="loading-dot">.</span>
        <span className="loading-dot">.</span>
        <span className="loading-dot">.</span>
      </span>
    );
  if (state === "awaiting_human") return <span className="badge badge-awaiting">AWAITING REVIEW</span>;
  if (finalStatus === "APPROVED") return <span className="badge badge-approved">APPROVED</span>;
  if (finalStatus === "DENIED") return <span className="badge badge-denied">DENIED</span>;
  return <span className="badge badge-idle">PENDING</span>;
}

function JsonDisplay({ data }: { data: unknown }) {
  const text = JSON.stringify(data, null, 2);
  return <pre className="code-block">{text}</pre>;
}

function App() {
  const [session, setSession] = useState<Session>(INITIAL_SESSION);
  const [selectedFile, setSelectedFile] = useState(Object.keys(CLAIM_FILES)[0]);
  const [leftTab, setLeftTab] = useState<"raw" | "parsed" | "masked">("raw");
  const [showTokenMap, setShowTokenMap] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedEdi, setUploadedEdi] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<"sample" | "upload">("sample");

  const rawEdi =
    inputMode === "upload" && uploadedEdi
      ? uploadedEdi
      : getRawEdi(CLAIM_FILES[selectedFile]);

  const handleProcess = useCallback(async () => {
    setSession({ ...INITIAL_SESSION, processingState: "running", stage: "parsing" });

    const result = await processClaim(rawEdi, (stage) => {
      setSession((prev) => ({ ...prev, stage }));
    });

    if (result.decision === "HUMAN_REVIEW") {
      setSession({
        ...result,
        processingState: "awaiting_human",
        finalStatus: "PENDING",
        stage: "",
      });
    } else {
      setSession({ ...result, processingState: "done", stage: "" });
    }
  }, [rawEdi]);

  const handleHumanDecision = useCallback(
    async (decision: "APPROVE" | "DENY") => {
      if (!session.threadId) return;
      setSession((prev) => ({ ...prev, processingState: "running", stage: "payment" }));
      const result = await processHumanDecision(session.threadId, decision, (stage) => {
        setSession((prev) => ({ ...prev, stage }));
      });
      setSession((prev) => ({
        ...prev,
        paymentOutput: result.paymentOutput,
        finalStatus: result.finalStatus,
        processingSeconds: result.processingSeconds || prev.processingSeconds,
        processingState: "done",
        stage: "",
      }));
    },
    [session.threadId]
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        setUploadedEdi(text);
      };
      reader.readAsText(file);
    },
    []
  );

  const metricValueClass =
    session.finalStatus === "APPROVED"
      ? "approved"
      : session.finalStatus === "DENIED"
        ? "denied"
        : session.processingState === "awaiting_human"
          ? "awaiting"
          : "";

  const decisionLabel =
    session.finalStatus !== "PENDING" || session.processingState !== "awaiting_human"
      ? session.finalStatus
      : "AWAITING REVIEW";

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-eyebrow">AI-Powered Workflow</div>
        <div>
          <span className="header-title">Claims Processing</span>
        </div>
        <p className="header-desc">
          Replace a 30-day manual process with a 60-second AI-powered workflow.
          Select a sample claim or upload your own EDI file, then click Process Claim.
        </p>
      </header>

      <hr className="divider" />

      {/* ── Controls card ── */}
      <div className="controls-card">
        <div className="input-tabs">
          <button
            className={`input-tab ${inputMode === "sample" ? "active" : ""}`}
            onClick={() => setInputMode("sample")}
          >
            Sample Claims
          </button>
          <button
            className={`input-tab ${inputMode === "upload" ? "active" : ""}`}
            onClick={() => setInputMode("upload")}
          >
            Upload EDI File
          </button>
        </div>

        <div className="controls">
          {inputMode === "sample" ? (
            <div className="control-group">
              <label className="control-label">Select Claim</label>
              <select
                className="control-select"
                value={selectedFile}
                onChange={(e) => setSelectedFile(e.target.value)}
                disabled={session.processingState === "running"}
              >
                {Object.keys(CLAIM_FILES).map((label) => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="control-group">
              <label className="control-label">Upload File</label>
              <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
                {uploadedEdi
                  ? <span className="upload-success">✓ File loaded</span>
                  : "Click to upload .edi or .txt"}
                <input ref={fileInputRef} type="file" accept=".edi,.txt" onChange={handleFileUpload} />
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
            <button
              className="btn-process"
              onClick={handleProcess}
              disabled={session.processingState === "running"}
            >
              ▶ Process Claim
            </button>
            <StatusBadge state={session.processingState} finalStatus={session.finalStatus} />
          </div>
        </div>
      </div>

      {/* ── Main two-column ── */}
      <div className="main-grid">
        {/* ── LEFT: Claim Data ── */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-header-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </span>
            Claim Data
          </div>
          <div className="tabs">
            <button
              className={`tab ${leftTab === "raw" ? "active" : ""}`}
              onClick={() => setLeftTab("raw")}
            >
              Raw EDI
            </button>
            <button
              className={`tab ${leftTab === "parsed" ? "active" : ""}`}
              onClick={() => setLeftTab("parsed")}
            >
              Parsed JSON
            </button>
            <button
              className={`tab ${leftTab === "masked" ? "active" : ""}`}
              onClick={() => setLeftTab("masked")}
            >
              Masked JSON
            </button>
          </div>

          <div className="tab-content">
            {leftTab === "raw" && <pre className="code-block">{rawEdi}</pre>}

            {leftTab === "parsed" &&
              (session.parsedClaim ? (
                <JsonDisplay data={session.parsedClaim} />
              ) : (
                <div className="empty-state">
                  <span className="empty-state-icon">{ }</span>
                  Run the pipeline to see parsed JSON
                </div>
              ))}

            {leftTab === "masked" &&
              (session.maskedClaim ? (
                <>
                  <div className="phi-badge">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                    PHI PROTECTED — Names and addresses replaced with tokens
                  </div>
                  <JsonDisplay data={session.maskedClaim} />
                  {Object.keys(session.tokenMap).length > 0 && (
                    <>
                      <button
                        className="expander-trigger"
                        onClick={() => setShowTokenMap(!showTokenMap)}
                      >
                        {showTokenMap ? "Hide" : "Show"} token map (server-side only)
                      </button>
                      {showTokenMap && <JsonDisplay data={session.tokenMap} />}
                    </>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <span className="empty-state-icon">🔒</span>
                  Run the pipeline to see masked JSON
                </div>
              ))}
          </div>
        </div>

        {/* ── RIGHT: AI Processing ── */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-header-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            </span>
            AI Processing
          </div>

          {session.intakeOutput && (
            <div className="agent-section">
              <div className="agent-label">
                <span className="agent-icon agent-icon-1">1</span>
                Intake Review
              </div>
              <div className="agent-output">{session.intakeOutput}</div>
            </div>
          )}

          {session.decisionOutput && !session.processingState.startsWith("awaiting") && (
            <div className="agent-section">
              <div className="agent-label">
                <span className="agent-icon agent-icon-2">2</span>
                Decision
              </div>
              <div className="agent-output">{session.decisionOutput}</div>
            </div>
          )}

          {session.processingState === "awaiting_human" && (
            <div className="human-review">
              <div className="human-review-title">
                Human Review Required
              </div>
              <div className="human-review-desc">
                AI flagged this claim for manual decision.
              </div>
              <div className="human-review-summary">AI Summary</div>
              <div className="human-review-output">
                {session.decisionOutput}
              </div>
              <div className="human-review-actions">
                <button
                  className="btn-approve"
                  onClick={() => handleHumanDecision("APPROVE")}
                >
                  APPROVE
                </button>
                <button
                  className="btn-deny"
                  onClick={() => handleHumanDecision("DENY")}
                >
                  DENY
                </button>
              </div>
            </div>
          )}

          {session.paymentOutput && (
            <div className="agent-section">
              <div className="agent-label">
                <span className="agent-icon agent-icon-3">3</span>
                Payment Calculation
              </div>
              <div className="agent-output">{session.paymentOutput}</div>
            </div>
          )}

          {!session.intakeOutput &&
            !session.decisionOutput &&
            !session.paymentOutput &&
            session.processingState !== "running" && (
              <div className="tab-content">
                <div className="empty-state">
                  <span className="empty-state-icon">🤖</span>
                  Run the pipeline to see AI agent outputs
                </div>
              </div>
            )}

          {session.processingState === "running" && !session.intakeOutput && (
            <div className="tab-content">
              <div className="empty-state" style={{ color: "var(--blue-600)" }}>
                Initializing pipeline
                <span className="loading-dot">.</span>
                <span className="loading-dot">.</span>
                <span className="loading-dot">.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Results strip ── */}
      {(session.processingState === "done" ||
        session.processingState === "awaiting_human") && (
        <div className="results-strip">
          <div className="results-label">Results</div>
          <div className="results-grid">
            <div className="metric-card">
              <div className="metric-label">Decision</div>
              <div className={`metric-value ${metricValueClass}`}>
                {decisionLabel}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Processing Time</div>
              <div className="metric-value">
                {session.processingSeconds
                  ? `${session.processingSeconds}s`
                  : "—"}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">PHI Tokens Masked</div>
              <div className="metric-value">
                {Object.keys(session.tokenMap).length}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">
                {session.guardrailWarnings.length > 0
                  ? "Guardrail Alerts"
                  : "PHI in AI Output"}
              </div>
              <div className="metric-value">
                {session.guardrailWarnings.length > 0
                  ? session.guardrailWarnings.length
                  : "None detected"}
              </div>
            </div>
          </div>

          {session.guardrailWarnings.map((w, i) => (
            <div key={i} className="warning-banner">
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
