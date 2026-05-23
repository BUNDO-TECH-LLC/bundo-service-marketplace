export function WhySection() {
  return (
    <section className="why">
      <div className="why-inner">
        <div className="why-copy">
          <h2>Why Bundo?</h2>
          <p className="why-intro">
            We believe in quality over quantity. Every professional on our platform undergoes a rigorous
            multi-step verification process to ensure your peace of mind.
          </p>
          <ul className="why-features">
            <li className="why-feature">
              <span className="why-feature-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </span>
              <div>
                <h3>Verified Professionals</h3>
                <p>Background checks and skills assessment for every artisan.</p>
              </div>
            </li>
            <li className="why-feature">
              <span className="why-feature-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
                </svg>
              </span>
              <div>
                <h3>Secure Payments</h3>
                <p>Escrow-based payments that release only when the job is done.</p>
              </div>
            </li>
            <li className="why-feature">
              <span className="why-feature-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
                </svg>
              </span>
              <div>
                <h3>24/7 Priority Support</h3>
                <p>A dedicated concierge team to handle any requests or issues.</p>
              </div>
            </li>
          </ul>
        </div>
        <div className="why-visual" aria-hidden>
          <div className="why-visual-panel">
            <div className="why-float why-float-profile">
              <svg className="why-float-profile-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="why-float-profile-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
            </div>
            <div className="why-float why-float-shield">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div className="why-float why-float-message">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                <path d="m13 7-4 5h4l-1 5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
