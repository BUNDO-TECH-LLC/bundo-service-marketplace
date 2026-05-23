import { api } from '../lib/api';
import { EmptyState } from '../components/EmptyState';
import type { ActionRunner, AdminArtisanRecord, AdminUserRecord } from '../appTypes';
import { AdminPortfolioGallery } from '../components/AdminPortfolioGallery';
import type { Artisan, Role } from '../types';

export function AdminProfilesPanel({
  token,
  users,
  artisans,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  users: AdminUserRecord[];
  artisans: AdminArtisanRecord[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  async function updateStatus(firebaseUid: string, status: 'ACTIVE' | 'BANNED') {
    await api(`/admin/users/${firebaseUid}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status }),
    });
    await refresh();
  }

  async function updateRole(firebaseUid: string, role: Role) {
    await api(`/admin/users/${firebaseUid}/role`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ role }),
    });
    await refresh();
  }

  async function updateVerification(artisanId: string, verifyStatus: Artisan['verifyStatus']) {
    await api(`/admin/artisans/${artisanId}/verify`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ verifyStatus }),
    });
    await refresh();
  }

  return (
    <section className="admin-panel">
      <div className="admin-stack">
        <article className="admin-surface">
          <div className="admin-surface-head">
            <div>
              <p className="eyebrow">Accounts</p>
              <h3>All users</h3>
            </div>
          </div>
          <div className="admin-inline-table" role="list">
            {users.length === 0 && (
              <EmptyState title="No users loaded" body="Refresh admin data or widen the user list limit." />
            )}
            {users.map((user) => (
              <article className="admin-row admin-row--profile" key={user.firebaseUid} role="listitem">
                <div className="admin-row-grid admin-row-grid--profile">
                  <div className="admin-row-primary">
                    <strong className="admin-row-title">{user.email || user.phone || user.firebaseUid}</strong>
                    <p className="admin-row-sub">{user.firebaseUid}</p>
                    <div className="admin-row-chips">
                      <span className={`booking-status ${user.status.toLowerCase() === 'active' ? 'accepted' : 'cancelled'}`}>
                        {user.status.toLowerCase()}
                      </span>
                      <span className="booking-status">{(user.role || 'UNASSIGNED').toLowerCase()}</span>
                    </div>
                  </div>
                  <dl className="admin-row-fields admin-row-fields--compact">
                    <div>
                      <dt>Phone</dt>
                      <dd>{user.phone || '—'}</dd>
                    </div>
                    <div>
                      <dt>Artisan</dt>
                      <dd>{user.artisanProfile?.displayName || '—'}</dd>
                    </div>
                  </dl>
                </div>
                <div className="admin-row-actions admin-row-actions--inline">
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() =>
                      runAction(
                        () => updateStatus(user.firebaseUid, user.status === 'ACTIVE' ? 'BANNED' : 'ACTIVE'),
                        user.status === 'ACTIVE' ? 'User banned' : 'User reactivated'
                      )
                    }
                  >
                    {user.status === 'ACTIVE' ? 'Ban' : 'Restore'}
                  </button>
                  {(['CUSTOMER', 'ARTISAN', 'ADMIN'] as Role[]).map((role) => (
                    <button
                      key={role}
                      className={user.role === role ? 'primary-button' : 'secondary-button'}
                      disabled={busy}
                      onClick={() => runAction(() => updateRole(user.firebaseUid, role), `Role changed to ${role.toLowerCase()}`)}
                    >
                      {role.toLowerCase()}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="admin-surface">
          <div className="admin-surface-head">
            <div>
              <p className="eyebrow">Supply</p>
              <h3>Artisan profiles</h3>
            </div>
          </div>
          <div className="admin-inline-table" role="list">
            {artisans.length === 0 && (
              <EmptyState title="No artisan profiles" body="Artisans will appear here once they register." />
            )}
            {artisans.map((artisan) => (
              <article className="admin-row admin-row--profile" key={artisan.id} role="listitem">
                <div className="admin-row-grid admin-row-grid--profile">
                  <div className="admin-row-primary">
                    <strong className="admin-row-title">{artisan.displayName}</strong>
                    <p className="admin-row-sub">{artisan.user?.email || artisan.city}</p>
                    <div className="admin-row-chips">
                      <span className={`booking-status ${artisan.verifyStatus.toLowerCase()}`}>
                        {artisan.verifyStatus.toLowerCase()}
                      </span>
                      <span className="booking-status">
                        {artisan.avgRating.toFixed(1)} ({artisan.ratingCount})
                      </span>
                    </div>
                  </div>
                  <dl className="admin-row-fields admin-row-fields--compact">
                    <div>
                      <dt>Location</dt>
                      <dd>{[artisan.area, artisan.city].filter(Boolean).join(', ') || '—'}</dd>
                    </div>
                    <div>
                      <dt>Photos</dt>
                      <dd>
                        {artisan._count?.portfolioImages ?? artisan.portfolioImages?.length ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt>Activity</dt>
                      <dd>
                        {artisan._count?.offerings || 0} offers · {artisan._count?.bookingsReceived || 0} jobs
                      </dd>
                    </div>
                  </dl>
                </div>
                {(artisan.portfolioImages?.length ?? 0) > 0 && (
                  <div className="admin-review-photos admin-review-photos--inline">
                    <AdminPortfolioGallery images={artisan.portfolioImages ?? []} artisanName={artisan.displayName} />
                  </div>
                )}
                <div className="admin-row-actions admin-row-actions--inline">
                  {(['PENDING', 'APPROVED', 'REJECTED'] as Artisan['verifyStatus'][]).map((status) => (
                    <button
                      key={status}
                      className={artisan.verifyStatus === status ? 'primary-button' : 'secondary-button'}
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () => updateVerification(artisan.id, status),
                          `Artisan marked ${status.toLowerCase()}`
                        )
                      }
                    >
                      {status.toLowerCase()}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
