import { useState, type ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import bundoLogo from '../assets/bundo-logo.png';
import { IconHelp, TopbarNavButton } from '../components/TopbarNavIcons';
import { auth } from '../lib/firebase';
import { buildAppPath } from '../lib/appPaths';
import { useAppRoot } from '../app/appRootContext';

export function ArtisanSetupShell({
  displayName,
  email,
  children,
}: {
  displayName: string;
  email?: string | null;
  children: ReactNode;
}) {
  const ctx = useAppRoot();
  const [menuOpen, setMenuOpen] = useState(false);
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="artisan-setup-shell">
      <header className="artisan-setup-topline artisan-setup-topline--menu">
        <button className="brand setup-brand" type="button" onClick={() => ctx.navigate('/')}>
          <img className="brand-logo" src={bundoLogo} alt="Bundo logo" />
          <span>Bundo</span>
        </button>

        <div className="artisan-setup-topline-actions">
          <TopbarNavButton
            label="Help"
            icon={<IconHelp />}
            onClick={() => ctx.navigate(buildAppPath({ view: 'help' }))}
          />

          <div className="artisan-setup-account">
            <button
              type="button"
              className="account-chip"
              aria-label="Open account menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="account-avatar">{initial}</span>
            </button>

            {menuOpen && (
              <div className="account-menu artisan-setup-account-menu">
                <div className="account-menu-head">
                  <span className="account-avatar large">{initial}</span>
                  <div>
                    <strong>{displayName}</strong>
                    <small>{email || 'Artisan account'}</small>
                    <em>Profile setup</em>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    ctx.navigate(buildAppPath({ view: 'help' }));
                  }}
                >
                  Help center
                </button>
                <button
                  type="button"
                  className="danger-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    ctx.setNotice('Signed out');
                    if (auth) {
                      void signOut(auth);
                    }
                  }}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
