import { Link } from 'react-router-dom';
import bundoLogo from '../../assets/BundoLogo.png';

export function Footer({
  onOpenHelpTopic,
}: {
  onOpenHelpTopic: (topicId: string) => void;
}) {
  const cities = ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano', 'Enugu', 'Uyo', 'Benin City'];
  const footerTopics = [
    ['About us', 'getting-started'],
    ['Payments', 'payments'],
    ['Disputes', 'disputes'],
    ['Cancellations', 'cancellations'],
    ['Provider standards', 'artisan-standards'],
    ['Quick links', 'support'],
  ] as const;

  return (
    <footer>
      <div className="footer-links">
        {footerTopics.map(([label, topicId]) => (
          <button key={label} type="button" onClick={() => onOpenHelpTopic(topicId)}>
            {label}
          </button>
        ))}
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
      </div>
      <h4>Currently live in</h4>
      <div className="city-list">{cities.map((city) => <span key={city}>{city}</span>)}</div>
      <div className="footer-bottom">
        <img className="brand-logo" src={bundoLogo} alt="Bundo logo" />
        <span>Bundo</span>
        <small>© 2026 Bundo Marketplace</small>
      </div>
    </footer>
  );
}



