import { Link } from 'react-router-dom';
import { BUNDO_SUPPORT_EMAIL } from '../constants/support';
import { privacyPolicy, termsOfService, type LegalDocument } from '../content/legalContent';

export function TermsPage() {
  return <LegalDocumentPage document={termsOfService} />;
}

export function PrivacyPage() {
  return <LegalDocumentPage document={privacyPolicy} />;
}

function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <main className="page legal-page">
      <div className="legal-document">
        <Link className="legal-back-link" to="/">
          ← Back to home
        </Link>
        <p className="eyebrow">Legal</p>
        <h1>{document.title}</h1>
        <p className="legal-summary">{document.summary}</p>
        <p className="legal-meta">Last updated: {document.lastUpdated}</p>

        {document.sections.map((section) => (
          <section key={section.heading} className="legal-section">
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.bullets && (
              <ul>
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <footer className="legal-footer">
          <p>
            Questions? Email{' '}
            <a href={`mailto:${BUNDO_SUPPORT_EMAIL}`}>{BUNDO_SUPPORT_EMAIL}</a>
          </p>
          <p>
            <Link to="/terms">Terms of Service</Link>
            {' · '}
            <Link to="/privacy">Privacy Policy</Link>
            {' · '}
            <Link to="/help">Help center</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
