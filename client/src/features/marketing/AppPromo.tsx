export function AppPromo() {
  return (
    <section className="app-promo" aria-labelledby="app-promo-quote">
      <div className="app-promo-inner">
        <div className="app-promo-quote-wrap">
          <span className="app-promo-quote-icon" aria-hidden>
            <svg width="36" height="28" viewBox="0 0 36 28" fill="none">
              <path
                d="M4 18c0-6 4-10 10-10V4C6 4 0 10 0 18v6h14v-6H4Zm22 0c0-6 4-10 10-10V4c-8 0-14 6-14 14v6h14v-6H26Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <blockquote className="app-promo-quote" id="app-promo-quote">
            Finding a reliable electrician used to take days. With Bundo, I booked a verified professional
            in minutes and had peace of mind from start to finish.
          </blockquote>
          <div className="app-promo-byline">
            <span className="app-promo-avatar" aria-hidden>
              ★
            </span>
            <div className="app-promo-cite">
              <span className="app-promo-name">Bundo customer</span>
              <span className="app-promo-role">Homeowner in Lagos</span>
            </div>
          </div>
        </div>
        <hr className="app-promo-divider" />
      </div>
    </section>
  );
}

