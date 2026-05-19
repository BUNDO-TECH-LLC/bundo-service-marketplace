import { Link } from 'react-router-dom';

const linkClassName = 'font-medium text-[var(--color-accent-link)] no-underline hover:text-[var(--color-accent-dark)]';

export function LegalLinks() {
  return (
    <>
      <Link className={linkClassName} to="/terms">
        Terms of Service
      </Link>
      {' and '}
      <Link className={linkClassName} to="/privacy">
        Privacy Policy
      </Link>
    </>
  );
}
