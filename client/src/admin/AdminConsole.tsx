import { useState } from 'react';
import { AdminChatPanel } from '../panels/AdminChatPanel';
import type { ActionRunner, AdminArtisanRecord, AdminCategoryRecord, AdminSection, AdminUserRecord } from '../appTypes';
import type { ArtisanKycSubmission, Booking, Conversation } from '../types';
import { AdminBookingsPanel } from './AdminBookingsPanel';
import { AdminCatalogPanel } from './AdminCatalogPanel';
import { AdminKycPanel } from './AdminKycPanel';
import { AdminOverviewPanel } from './AdminOverviewPanel';
import { AdminProfilesPanel } from './AdminProfilesPanel';

export function AdminConsole({
  section,
  setSection,
  stats,
  users,
  artisans,
  bookings,
  conversations,
  submissions,
  categories,
  token,
  adminLabel,
  busy,
  runAction,
  refresh,
  onSignOut,
}: {
  section: AdminSection;
  setSection: (section: AdminSection) => void;
  stats: Record<string, number> | null;
  users: AdminUserRecord[];
  artisans: AdminArtisanRecord[];
  bookings: Booking[];
  conversations: Conversation[];
  submissions: ArtisanKycSubmission[];
  categories: AdminCategoryRecord[];
  token: string;
  adminLabel: string;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  onSignOut: () => void;
}) {
  const [messagesFocusConversationId, setMessagesFocusConversationId] = useState<string | null>(null);

  const sections: Array<{
    id: AdminSection;
    label: string;
    description: string;
    count?: number;
  }> = [
    { id: 'overview', label: 'Overview', description: 'Signals and open work' },
    { id: 'profiles', label: 'Profiles', description: 'Users and artisans', count: users.length + artisans.length },
    { id: 'jobs', label: 'Jobs', description: 'Lifecycle, chat, payouts', count: bookings.length },
    { id: 'messages', label: 'Messages', description: 'Threads and notes', count: conversations.length },
    { id: 'verification', label: 'Verification', description: 'KYC and approvals', count: submissions.length },
    { id: 'catalog', label: 'Catalog', description: 'Service categories', count: categories.length },
  ];

  return (
    <section className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head">
          <p className="eyebrow">Admin console</p>
          <h1>Bundo operations</h1>
          <p>Manage trust, supply, support, and marketplace activity from one place.</p>
        </div>
        <div className="admin-operator-card">
          <span>Signed in as</span>
          <strong>{adminLabel}</strong>
          <button type="button" onClick={onSignOut}>Log out</button>
        </div>
        <nav className="admin-nav" aria-label="Admin sections">
          {sections.map((item) => (
            <button
              key={item.id}
              className={section === item.id ? 'active' : ''}
              type="button"
              onClick={() => setSection(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
              {typeof item.count === 'number' ? <strong>{item.count}</strong> : null}
            </button>
          ))}
        </nav>
      </aside>

      <section className="admin-main">
        {section === 'overview' && (
          <AdminOverviewPanel
            stats={stats}
            users={users}
            artisans={artisans}
            bookings={bookings}
            conversations={conversations}
            submissions={submissions}
            setSection={setSection}
          />
        )}
        {section === 'profiles' && (
          <AdminProfilesPanel
            token={token}
            users={users}
            artisans={artisans}
            busy={busy}
            runAction={runAction}
            refresh={refresh}
          />
        )}
        {section === 'jobs' && (
          <AdminBookingsPanel
            token={token}
            bookings={bookings}
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
            submissions={submissions}
            artisans={artisans}
            busy={busy}
            runAction={runAction}
            refresh={refresh}
          />
        )}
        {section === 'catalog' && (
          <AdminCatalogPanel
            token={token}
            categories={categories}
            busy={busy}
            runAction={runAction}
            refresh={refresh}
          />
        )}
      </section>
    </section>
  );
}