import type { AdminSection } from '../appTypes';
import { EmptyState } from '../components/EmptyState';
import { adminMetricLabel } from './adminMetricLabel';

const KEY_METRICS = [
  'users',
  'artisans',
  'bookings',
  'payments',
  'openDisputes',
  'conversations',
] as const;

export function AdminOverviewPanel({
  stats,
  setSection,
}: {
  stats: Record<string, number> | null;
  setSection: (section: AdminSection) => void;
}) {
  const priorityItems = stats
    ? [
        {
          title: 'Pending KYC reviews',
          value: stats.pendingKycSubmissions ?? 0,
          action: 'Open verification',
          section: 'verification' as AdminSection,
        },
        {
          title: 'New appointments',
          value: stats.bookingAppointments ?? 0,
          action: 'Open jobs',
          section: 'jobs' as AdminSection,
        },
        {
          title: 'Open disputes',
          value: stats.openDisputes ?? 0,
          action: 'Open jobs',
          section: 'jobs' as AdminSection,
        },
        {
          title: 'Artisans awaiting review',
          value: stats.pendingArtisans ?? 0,
          action: 'Open profiles',
          section: 'profiles' as AdminSection,
        },
      ]
    : [];

  return (
    <section className="admin-panel">
      <p className="admin-panel-lead muted">
        Live counts from the database — use the priority queue for work that needs attention.
      </p>

      <div className="admin-stat-grid admin-stat-grid--key">
        {!stats && (
          <EmptyState title="Admin stats unavailable" body="Sign in as an admin, then reopen this page." />
        )}
        {stats &&
          KEY_METRICS.map((key) => (
            <article className={`admin-stat-card${key === 'openDisputes' && stats[key] > 0 ? ' admin-stat-card--alert' : ''}`} key={key}>
              <span>{adminMetricLabel(key)}</span>
              <strong>{stats[key] ?? 0}</strong>
            </article>
          ))}
      </div>

      <div className="admin-overview-grid">
        <article className="admin-surface">
          <div className="admin-surface-head">
            <div>
              <p className="eyebrow">Priority queue</p>
              <h3>Needs attention</h3>
            </div>
          </div>
          {!stats ? (
            <EmptyState title="No stats loaded" body="Refresh the page if this persists." />
          ) : (
            <div className="admin-priority-list">
              {priorityItems.map((item) => (
                <button
                  key={item.title}
                  className={`admin-priority-item${item.value > 0 ? ' admin-priority-item--active' : ''}`}
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
          )}
        </article>

        <article className="admin-surface">
          <div className="admin-surface-head">
            <div>
              <p className="eyebrow">Pipeline</p>
              <h3>Booking stages</h3>
            </div>
          </div>
          {!stats ? (
            <EmptyState title="No stats loaded" body="Refresh the page if this persists." />
          ) : (
            <dl className="admin-summary-list">
              <div>
                <dt>Requests</dt>
                <dd>{stats.bookingRequests ?? 0}</dd>
              </div>
              <div>
                <dt>Appointments</dt>
                <dd>{stats.bookingAppointments ?? 0}</dd>
              </div>
              <div>
                <dt>In progress</dt>
                <dd>{stats.bookingOngoing ?? 0}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{stats.bookingCompleted ?? 0}</dd>
              </div>
              <div>
                <dt>Approved artisans</dt>
                <dd>{stats.approvedArtisans ?? 0}</dd>
              </div>
              <div>
                <dt>Active listings</dt>
                <dd>{stats.offerings ?? 0}</dd>
              </div>
            </dl>
          )}
        </article>
      </div>
    </section>
  );
}
