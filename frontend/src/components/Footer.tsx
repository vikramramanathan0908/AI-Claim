import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="nav-logo-mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
          <span className="nav-logo-text">Claim<span className="nav-logo-accent">IQ</span></span>
          <p className="footer-tag">
            Autonomous medical claims adjudication — HIPAA-aware, auditable, and 40,000× faster than manual review.
          </p>
        </div>

        <div className="footer-cols">
          <div className="footer-col">
            <span className="footer-col-title">Product</span>
            <Link to="/#dashboard">Dashboard</Link>
            <a href="#features">Features</a>
            <a href="#workflow">How it works</a>
            <a href="#security">Security</a>
            <Link to="/app">Console</Link>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">Platform</span>
            <a href="#workflow">Multi-agent pipeline</a>
            <a href="#features">RAG rules engine</a>
            <a href="#security">PHI tokenization</a>
            <a href="#features">Human-in-the-loop</a>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">Compliance</span>
            <a href="#security">HIPAA</a>
            <a href="#security">Audit trail</a>
            <a href="#security">Data residency</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} ClaimIQ. Demonstration system.</span>
        <span className="footer-bottom-meta">Built with FastAPI · LangGraph · OpenAI · Supabase</span>
      </div>
    </footer>
  );
}
