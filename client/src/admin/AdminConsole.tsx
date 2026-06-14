import { useEffect, useState } from 'react';
import { AdminChatPanel } from '../panels/AdminChatPanel';
import type { ActionRunner, AdminArtisanRecord, AdminCategoryRecord, AdminSection, AdminUserRecord } from '../appTypes';
import type { ArtisanKycSubmission, Booking, Conversation } from '../types';
import { AdminBookingsPanel } from './AdminBookingsPanel';
import { AdminCatalogPanel } from './AdminCatalogPanel';
import { AdminKycPanel } from './AdminKycPanel';
import { AdminOverviewPanel } from './AdminOverviewPanel';
import { AdminLedgerPanel } from './AdminLedgerPanel';
import { AdminProfilesPanel } from './AdminProfilesPanel';
import { AdminReviewsPanel } from './AdminReviewsPanel';
import { adminNavBadge } from './adminNavBadges';
import bundoLogo from '../assets/BundoLogo.png';

export function AdminConsole({
  section,
  setSection,
  stats,
  users,
  artisans,
  bookings,
  bookingsTotal,
  conversations,
  submissions,
  categories,
  token,
  adminLabel,
  busy,
  runAction,
  refresh,
  loadAdminSection,
  onSignOut,
}: {
  section: AdminSection;
  setSection: (section: AdminSection) => void;
  stats: Record<string, number> | null;
  users: AdminUserRecord[];
  artisans: AdminArtisanRecord[];
  bookings: Booking[];
  bookingsTotal?: number;
  conversations: Conversation[];
  submissions: ArtisanKycSubmission[];
  categories: AdminCategoryRecord[];
  token: string;
  adminLabel: string;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  loadAdminSection: (section: AdminSection) => Promise<void>;
  onSignOut: () => void;
}) {
  const [messagesFocusConversationId, setMessagesFocusConversationId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const sections: Array<{
    id: AdminSection;
    label: string;
    description: string;
  }> = [
    { id: 'overview', label: 'Overview', description: 'Platform snapshot' },
    { id: 'profiles', label: 'Profiles', description: 'Users & artisans' },
    { id: 'jobs', label: 'Jobs', description: 'Lifecycle & payouts' },
    { id: 'messages', label: 'Messages', description: 'Support threads' },
    { id: 'verification', label: 'Verification', description: 'KYC queue' },
    { id: 'catalog', label: 'Catalog', description: 'Categories' },
    { id: 'reviews', label: 'Reviews', description: 'Moderation' },
    { id: 'finance', label: 'Finance', description: 'Ledger trail' },
  ];

  const activeSection = sections.find((item) => item.id === section) ?? sections[0];

  const closeMobileNav = () => setMobileNavOpen(false);

  const goToSection = (next: AdminSection) => {
    closeMobileNav();
    setSection(next);
  };

  useEffect(() => {
    if (!mobileNavOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobileNav();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  useEffect(() => {
    closeMobileNav();
  }, [section]);

  useEffect(() => {
    void loadAdminSection(section).catch(() => undefined);
  }, [section, loadAdminSection]);

  return (
    <section className={`admin-shell ${mobileNavOpen ? 'admin-shell--nav-open' : ''}`}>
      <header className="admin-mobile-bar">
        <button
          type="button"
          className="admin-mobile-menu-toggle"
          aria-label={mobileNavOpen ? 'Close admin menu' : 'Open admin menu'}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span className="artisan-header-menu-toggle-bars" aria-hidden="true" />
        </button>
        <div className="admin-mobile-bar-copy">
          <p className="eyebrow">Admin console</p>
          <strong>{activeSection.label}</strong>
        </div>
        <button type="button" className="text-button admin-mobile-signout" onClick={onSignOut}>
          Log out
        </button>
      </header>

      {mobileNavOpen && (
        <button
          type="button"
          className="admin-mobile-backdrop"
          aria-label="Close menu"
          onClick={closeMobileNav}
        />
      )}

      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-sidebar-head">
          <div className="admin-sidebar-brand">
            <img className="admin-sidebar-logo" src={bundoLogo} alt="" />
            <span className="admin-sidebar-wordmark">Bundo</span>
          </div>
          <h1>Operations</h1>
          <p>Trust, jobs, support, and marketplace activity.</p>
        </div>
        <div className="admin-operator-card">
          <span>Signed in as</span>
          <strong>{adminLabel}</strong>
          <button type="button" className="admin-sidebar-signout" onClick={onSignOut}>
            Log out
          </button>
        </div>
        <nav className="admin-nav" aria-label="Admin sections">
          {sections.map((item) => {
            const badge = adminNavBadge(item.id, stats);
            return (
              <button
                key={item.id}
                className={section === item.id ? 'active' : ''}
                type="button"
                onClick={() => goToSection(item.id)}
              >
                <span className="admin-nav-label">{item.label}</span>
                <small>{item.description}</small>
                {badge ? (
                  <span
                    className={`admin-nav-badge${badge.urgent ? ' urgent' : ''}`}
                    aria-label={`${badge.count} items need attention`}
                  >
                    {badge.count > 99 ? '99+' : badge.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="admin-main">
        <header className="admin-main-head">
          <div>
            <p className="eyebrow">{activeSection.description}</p>
            <h2>{activeSection.label}</h2>
          </div>
          <button
            type="button"
            className="secondary-button admin-refresh-button"
            disabled={busy}
            onClick={() => void runAction(refresh, 'Admin data refreshed')}
          >
            Refresh
          </button>
        </header>

        {section === 'overview' && <AdminOverviewPanel stats={stats} setSection={setSection} />}
        {section === 'profiles' && (
          <AdminProfilesPanel
            token={token}
            busy={busy}
            runAction={runAction}
            refresh={refresh}
            stats={stats}
          />
        )}
        {section === 'jobs' && (
          <AdminBookingsPanel
            token={token}
            bookings={bookings}
            bookingsTotal={bookingsTotal}
            busy={busy}
            runAction={runAction}
            refresh={refresh}
            setSection={setSection}
            onOpenConversation={setMessagesFocusConversationId}
          />
        )}
        {section === 'messages' && (
          <AdminChatPanel
            token={token}
            conversations={conversations}
            busy={busy}
            runAction={runAction}
            refresh={refresh}
            initialConversationId={messagesFocusConversationId}
            onConversationOpened={() => setMessagesFocusConversationId(null)}
          />
        )}
        {section === 'verification' && (
          <AdminKycPanel
            token={token}
            busy={busy}
            runAction={runAction}
            refresh={refresh}
          />
        )}
        {section === 'catalog' && (
          <AdminCatalogPanel
            token={token}
            busy={busy}
            runAction={runAction}
            refresh={refresh}
          />
        )}
        {section === 'reviews' && (
          <AdminReviewsPanel token={token} busy={busy} runAction={runAction} />
        )}
        {section === 'finance' && <AdminLedgerPanel token={token} />}
      </section>
    </section>
  );
}
