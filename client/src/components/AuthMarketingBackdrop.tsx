/** Lightweight marketing backdrop for auth pages (replaces legacy LandingPage). */
export function AuthMarketingBackdrop() {
  return (
    <div className="auth-marketing-backdrop" aria-hidden="true">
      <div className="auth-marketing-backdrop__orb auth-marketing-backdrop__orb--one" />
      <div className="auth-marketing-backdrop__orb auth-marketing-backdrop__orb--two" />
      <div className="auth-marketing-backdrop__grid" />
    </div>
  );
}
