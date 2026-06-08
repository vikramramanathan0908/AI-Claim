import { Link, useLocation } from "react-router-dom";

function Logo() {
  return (
    <Link to="/" className="nav-logo">
      <span className="nav-logo-mark">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </span>
      <span className="nav-logo-text">
        Claim<span className="nav-logo-accent">IQ</span>
      </span>
    </Link>
  );
}

export default function Navbar() {
  const { pathname } = useLocation();
  const onLanding = pathname === "/";

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Logo />

        {onLanding && (
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#workflow">How it works</a>
            <a href="#security">Security</a>
          </div>
        )}

        <div className="nav-actions">
          {onLanding ? (
            <Link to="/app" className="nav-cta">
              Launch Console
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          ) : (
            <Link to="/" className="nav-ghost">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M11 18l-6-6 6-6" />
              </svg>
              Back to site
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
