import { api } from '../lib/api';
import type { ActionRunner, AdminArtisanRecord, AdminUserRecord } from '../appTypes';
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
      <header className="admin-panel-head">
        <div>
          <p className="eyebrow">Profiles</p>
          <h2>Users and service providers</h2>
          <p>Adjust account access, roles, and artisan verification without leaving the admin surface.</p>
        </div>
      </header>

      <div className="admin-stack">
        <article className="admin-surface">
          <div className="admin-surface-head">
            <div>
              <p className="eyebrow">Accounts</p>
              <h3>All users</h3>
            </div>
          </div>
          <div className="admin-record-list">
            {users.map((user) => (
              <article className="admin-record-card" key={user.firebaseUid}>
                <div className="admin-record-head">
                  <div>
                    <h4>{user.email || user.phone || user.firebaseUid}</h4>
                    <p>{user.firebaseUid}</p>
                  </div>
                  <div className="admin-pill-row">
                    <span className={`booking-status ${user.status.toLowerCase() === 'active' ? 'accepted' : 'cancelled'}`}>
                      {user.status.toLowerCase()}
                    </span>
                    <span className="booking-status">{(user.role || 'UNASSIGNED').toLowerCase()}</span>
                  </div>
                </div>
                <dl className="admin-inline-list">
                  <div>
                    <dt>Phone</dt>
                    <dd>{user.phone || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt>Artisan profile</dt>
                    <dd>{user.artisanProfile?.displayName || 'None yet'}</dd>
                  </div>
                </dl>
                <div className="admin-action-row">
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
                    {user.status === 'ACTIVE' ? 'Ban user' : 'Restore user'}
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
          <div className="admin-record-list">
            {artisans.map((artisan) => (
              <article className="admin-record-card" key={artisan.id}>
                <div className="admin-record-head">
                  <div>
                    <h4>{artisan.displayName}</h4>
                    <p>{artisan.user?.email || artisan.city}</p>
                  </div>
                  <div className="admin-pill-row">
                    <span className={`booking-status ${artisan.verifyStatus.toLowerCase()}`}>
                      {artisan.verifyStatus.toLowerCase()}
                    </span>
                    <span className="booking-status">
                      {artisan.avgRating.toFixed(1)} ({artisan.ratingCount})
                    </span>
                  </div>
                </div>
                <dl className="admin-inline-list">
                  <div>
                    <dt>Location</dt>
                    <dd>{[artisan.area, artisan.city].filter(Boolean).join(', ')}</dd>
                  </div>
                  <div>
                    <dt>Activity</dt>
                    <dd>
                      {artisan._count?.offerings || 0} offers, {artisan._count?.bookingsReceived || 0} jobs
                    </dd>
                  </div>
                </dl>
                <div className="admin-action-row">
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