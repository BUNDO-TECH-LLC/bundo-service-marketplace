import type { AdminSection } from '../appTypes';
import { EmptyState } from '../components/EmptyState';
import { adminMetricLabel } from './adminMetricLabel';
import {
  OVERVIEW_PIPELINE_TARGETS,
  OVERVIEW_PRIORITY_TARGETS,
  OVERVIEW_STAT_TARGETS,
  type AdminOverviewTarget,
  type AdminSectionIntent,
} from './adminNavigation';

const KEY_METRICS = [
  'users',
  'artisans',
  'bookings',
  'payments',
  'openDisputes',
  'conversations',
] as const;

const PRIORITY_LABELS = [
  {
    title: 'Pending KYC reviews',
    action: 'Open verification',
    statKey: 'pendingKycSubmissions',
  },
  {
    title: 'New appointments',
    action: 'Open jobs',
    statKey: 'bookingAppointments',
  },
  {
    title: 'Open disputes',
    action: 'Open jobs',
    statKey: 'openDisputes',
  },
  {
    title: 'Artisans awaiting review',
    action: 'Open profiles',
    statKey: 'pendingArtisans',
  },
] as const;

export function AdminOverviewPanel({
  stats,
  navigateToSection,
}: {
  stats: Record<string, number> | null;
  navigateToSection: (section: AdminSection, intent?: AdminSectionIntent) => void;
}) {
  function openTarget(target: AdminOverviewTarget) {
    navigateToSection(target.section, target.intent);
  }

  const priorityItems =
    stats &&
    PRIORITY_LABELS.map((item, index) => ({
      ...item,
      value: stats[item.statKey] ?? 0,
      target: OVERVIEW_PRIORITY_TARGETS[index],
    }));

  return (
    <section className="admin-panel">
      <p className="admin-panel-lead muted">
        Live counts from the database — tap a metric or queue item to jump to the matching filtered view.
      </p>

      <div className="admin-stat-grid admin-stat-grid--key">
        {!stats && (
          <EmptyState title="Admin stats unavailable" body="Sign in as an admin, then reopen this page." />
        )}
        {stats &&
          KEY_METRICS.map((key) => {
            const target = OVERVIEW_STAT_TARGETS[key];
            return (
              <button
                key={key}
                type="button"
                className={`admin-stat-card admin-stat-card--clickable${
                  key === 'openDisputes' && stats[key] > 0 ? ' admin-stat-card--alert' : ''
                }`}
                onClick={() => openTarget(target)}
              >
                <span>{adminMetricLabel(key)}</span>
                <strong>{stats[key] ?? 0}</strong>
                <small className="admin-stat-card-hint">View filtered section</small>
              </button>
            );
          })}
      </div>

      <div className="admin-overview-grid">
        <article className="admin-surface">
          <div className="admin-surface-head">
            <div>
              <p className="eyebrow">Priority queue</p>
              <h3>Needs attention</h3>
            </div>
          </div>
          {!stats || !priorityItems ? (
            <EmptyState title="No stats loaded" body="Refresh the page if this persists." />
          ) : (
            <div className="admin-priority-list">
              {priorityItems.map((item) => (
                <button
                  key={item.title}
                  className={`admin-priority-item${item.value > 0 ? ' admin-priority-item--active' : ''}`}
                  type="button"
                  onClick={() => openTarget(item.target)}
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
            <div className="admin-pipeline-list">
              {OVERVIEW_PIPELINE_TARGETS.map((item) => (
                <button
                  key={item.statKey}
                  type="button"
                  className={`admin-pipeline-item${
                    (stats[item.statKey] ?? 0) > 0 ? ' admin-pipeline-item--active' : ''
                  }`}
                  onClick={() => openTarget(item)}
                >
                  <span>{item.label}</span>
                  <strong>{stats[item.statKey] ?? 0}</strong>
                </button>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
