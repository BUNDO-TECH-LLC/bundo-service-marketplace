import type { AdminSection, AdminArtisanRecord, AdminUserRecord } from '../appTypes';
import type { ArtisanKycSubmission, Booking, Conversation } from '../types';
import { EmptyState } from '../components/EmptyState';
import { adminMetricLabel } from './adminMetricLabel';

export function AdminOverviewPanel({
  stats,
  users,
  artisans,
  bookings,
  conversations,
  submissions,
  setSection,
}: {
  stats: Record<string, number> | null;
  users: AdminUserRecord[];
  artisans: AdminArtisanRecord[];
  bookings: Booking[];
  conversations: Conversation[];
  submissions: ArtisanKycSubmission[];
  setSection: (section: AdminSection) => void;
}) {
  const priorityItems = [
    {
      title: 'Pending KYC reviews',
      value: submissions.filter((submission) => submission.status === 'PENDING').length,
      action: 'Open verification',
      section: 'verification' as AdminSection,
    },
    {
      title: 'Open booking issues',
      value: bookings.filter((booking) =>
        booking.disputes?.some((dispute) => dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW')
      ).length,
      action: 'Open jobs',
      section: 'jobs' as AdminSection,
    },
    {
      title: 'Needs artisan review',
      value: artisans.filter((artisan) => artisan.verifyStatus === 'PENDING').length,
      action: 'Open profiles',
      section: 'profiles' as AdminSection,
    },
  ];

  return (
    <section className="admin-panel">
      <header className="admin-panel-head">
        <div>
          <p className="eyebrow">Overview</p>
          <h2>Run the marketplace, not the customer UI</h2>
          <p>Everything here is tuned for decisions, follow-up, and intervention.</p>
        </div>
      </header>

      <div className="admin-stat-grid">
        {!stats && <EmptyState title="Admin stats unavailable" body="Sign in as an admin, then reopen this page." />}
        {stats &&
          Object.entries(stats).map(([key, value]) => (
            <article className="admin-stat-card" key={key}>
              <span>{adminMetricLabel(key)}</span>
              <strong>{value}</strong>
            </article>
          ))}
      </div>

      <div className="admin-overview-grid">
        <article className="admin-surface">
          <div className="admin-surface-head">
            <div>
              <p className="eyebrow">Priority queue</p>
              <h3>What needs admin attention</h3>
            </div>
          </div>
          <div className="admin-priority-list">
            {priorityItems.map((item) => (
              <button
                key={item.title}
                className="admin-priority-item"
                type="button"
                onClick={() => setSection(item.section)}
              >
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.action}</small>
                </div>
                <span>{item.value}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="admin-surface">
          <div className="admin-surface-head">
            <div>
              <p className="eyebrow">Coverage</p>
              <h3>What the panel currently controls</h3>
            </div>
          </div>
          <dl className="admin-summary-list">
            <div>
              <dt>User accounts</dt>
              <dd>{users.length}</dd>
            </div>
            <div>
              <dt>Artisan profiles</dt>
              <dd>{artisans.length}</dd>
            </div>
            <div>
              <dt>Bookings loaded</dt>
              <dd>{bookings.length}</dd>
            </div>
            <div>
              <dt>Support threads</dt>
              <dd>{conversations.length}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
}