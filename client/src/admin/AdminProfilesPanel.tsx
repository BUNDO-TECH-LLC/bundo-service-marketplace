import { Fragment, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState } from '../components/EmptyState';
import type { ActionRunner, AdminArtisanRecord, AdminUserRecord } from '../appTypes';
import { AdminPortfolioGallery } from '../components/AdminPortfolioGallery';
import { Pagination } from '../components/Pagination';
import { useAdminList } from '../hooks/useAdminList';
import type { AdminProfilesFilter, AdminVerifyFilter } from './adminNavigation';
import { AdminTableScrollHint } from './AdminTableScrollHint';
import type { Artisan, Role } from '../types';

type ProfileFilter = AdminProfilesFilter;
type VerifyFilter = AdminVerifyFilter;

const profileFilters: Array<{ id: ProfileFilter; label: string; statKey?: keyof ProfileStats }> = [
  { id: 'all', label: 'All accounts', statKey: 'users' },
  { id: 'customer', label: 'Customers', statKey: 'clientAccounts' },
  { id: 'artisan', label: 'Artisans', statKey: 'artisans' },
  { id: 'admin', label: 'Admins', statKey: 'admins' },
];

const verifyFilters: Array<{ id: VerifyFilter; label: string }> = [
  { id: 'all', label: 'All statuses' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
];

type ProfileStats = {
  users?: number;
  clientAccounts?: number;
  artisans?: number;
  admins?: number;
  pendingArtisans?: number;
};

function accountLabel(user: AdminUserRecord) {
  return user.email || user.phone || user.firebaseUid.slice(0, 12);
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'active' || normalized === 'approved') return 'accepted';
  if (normalized === 'banned' || normalized === 'rejected') return 'cancelled';
  if (normalized === 'pending') return 'requested';
  return 'appointment';
}

export function AdminProfilesPanel({
  token,
  busy,
  runAction,
  refresh,
  stats,
  navigationIntent,
}: {
  token: string;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  stats: ProfileStats | null;
  navigationIntent?: { token: number; intent: { profiles?: { profileFilter?: ProfileFilter; verifyFilter?: VerifyFilter } } } | null;
}) {
  const [profileFilter, setProfileFilter] = useState<ProfileFilter>('all');
  const [verifyFilter, setVerifyFilter] = useState<VerifyFilter>('all');
  const [expandedArtisanId, setExpandedArtisanId] = useState<string | null>(null);

  useEffect(() => {
    const profilesIntent = navigationIntent?.intent.profiles;
    if (!profilesIntent) return;

    if (profilesIntent.profileFilter) {
      setProfileFilter(profilesIntent.profileFilter);
    }
    if (profilesIntent.verifyFilter) {
      setVerifyFilter(profilesIntent.verifyFilter);
    }
    setExpandedArtisanId(null);
  }, [navigationIntent?.token, navigationIntent?.intent.profiles]);

  const isArtisanView = profileFilter === 'artisan';

  const userRoleParam = useMemo((): Record<string, string> | undefined => {
    if (profileFilter === 'customer') return { role: 'CUSTOMER', clientsOnly: 'true' };
    if (profileFilter === 'admin') return { role: 'ADMIN' };
    return undefined;
  }, [profileFilter]);

  const isCustomerOnlyView = profileFilter === 'customer';

  const verifyParam = useMemo(() => {
    if (!isArtisanView || verifyFilter === 'all') return undefined;
    return { verifyStatus: verifyFilter };
  }, [isArtisanView, verifyFilter]);

  const usersList = useAdminList<AdminUserRecord>({
    token,
    path: '/admin/users',
    limit: 25,
    enabled: !isArtisanView,
    extraParams: userRoleParam,
    select: (response) => (response.users as AdminUserRecord[]) ?? [],
  });

  const artisansList = useAdminList<AdminArtisanRecord>({
    token,
    path: '/admin/artisans',
    limit: 20,
    enabled: isArtisanView,
    extraParams: verifyParam,
    select: (response) => (response.artisans as AdminArtisanRecord[]) ?? [],
  });

  const activeList = isArtisanView ? artisansList : usersList;

  async function updateStatus(firebaseUid: string, status: 'ACTIVE' | 'BANNED') {
    await api(`/admin/users/${firebaseUid}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status }),
    });
    await usersList.reload();
    await refresh();
  }

  async function updateRole(firebaseUid: string, role: Role) {
    await api(`/admin/users/${firebaseUid}/role`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ role }),
    });
    await usersList.reload();
    await refresh();
  }

  async function updateVerification(artisanId: string, verifyStatus: Artisan['verifyStatus']) {
    await api(`/admin/artisans/${artisanId}/verify`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ verifyStatus }),
    });
    await artisansList.reload();
    await refresh();
  }

  function switchFilter(next: ProfileFilter) {
    setProfileFilter(next);
    setExpandedArtisanId(null);
    if (next !== 'artisan') {
      setVerifyFilter('all');
    }
  }

  return (
    <section className="admin-panel admin-profiles-panel">
      <article className="admin-surface">
        <div className="admin-surface-head">
          <div>
            <p className="eyebrow">Directory</p>
            <h3>Profiles</h3>
            <p className="admin-panel-lead muted">
              Review customer accounts and artisan listings. The Customers filter shows booking-only accounts
              and excludes artisan applicants still awaiting approval.
            </p>
          </div>
          <span className="admin-surface-count">{activeList.total}</span>
        </div>

        <div className="admin-profiles-toolbar">
          <div className="admin-profiles-filters" role="tablist" aria-label="Profile filters">
            {profileFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={profileFilter === filter.id}
                className={profileFilter === filter.id ? 'active' : ''}
                onClick={() => switchFilter(filter.id)}
              >
                {filter.label}
                {stats && filter.statKey && stats[filter.statKey] !== undefined ? (
                  <strong>{stats[filter.statKey]}</strong>
                ) : null}
              </button>
            ))}
          </div>

          {isArtisanView && (
            <label className="admin-profiles-select-wrap">
              <span className="sr-only">Verification status</span>
              <select
                value={verifyFilter}
                disabled={busy || artisansList.loading}
                onChange={(event) => setVerifyFilter(event.target.value as VerifyFilter)}
              >
                {verifyFilters.map((filter) => (
                  <option key={filter.id} value={filter.id}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {activeList.error && <p className="admin-list-hint">{activeList.error}</p>}
        {activeList.loading && <p className="muted admin-profiles-loading">Loading profiles…</p>}

        {!activeList.loading && !isArtisanView && usersList.items.length === 0 && (
          <EmptyState title="No accounts found" body="Try another filter or check back after new sign-ups." />
        )}

        {!activeList.loading && isArtisanView && artisansList.items.length === 0 && (
          <EmptyState title="No artisan profiles found" body="Try another verification filter or check back later." />
        )}

        {!activeList.loading && !isArtisanView && usersList.items.length > 0 && (
          <div className="admin-table-scroll-wrap admin-profiles-table-wrap">
            <AdminTableScrollHint />
            <table className="admin-profiles-table admin-data-table">
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Phone</th>
                  {!isCustomerOnlyView && <th scope="col">Artisan profile</th>}
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersList.items.map((user) => (
                  <tr key={user.firebaseUid}>
                    <td data-label="Account">
                      <strong>{accountLabel(user)}</strong>
                      <span className="admin-profiles-meta">{user.firebaseUid.slice(0, 10)}…</span>
                    </td>
                    <td data-label="Role">
                      <select
                        className="admin-inline-select"
                        value={user.role || 'CUSTOMER'}
                        disabled={busy}
                        aria-label={`Role for ${accountLabel(user)}`}
                        onChange={(event) =>
                          void runAction(
                            () => updateRole(user.firebaseUid, event.target.value as Role),
                            `Role updated to ${event.target.value.toLowerCase()}`
                          )
                        }
                      >
                        <option value="CUSTOMER">Customer</option>
                        <option value="ARTISAN">Artisan</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                    <td data-label="Status">
                      <span className={`booking-status ${statusClass(user.status)}`}>
                        {user.status.toLowerCase()}
                      </span>
                    </td>
                    <td data-label="Phone">{user.phone || '—'}</td>
                    {!isCustomerOnlyView && (
                      <td data-label="Artisan profile">
                        {user.artisanProfile ? (
                          <>
                            <span>{user.artisanProfile.displayName}</span>
                            <span className={`booking-status ${statusClass(user.artisanProfile.verifyStatus)}`}>
                              {user.artisanProfile.verifyStatus.toLowerCase()}
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    <td data-label="Actions">
                      <button
                        type="button"
                        className="text-button admin-profiles-action"
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            () =>
                              updateStatus(
                                user.firebaseUid,
                                user.status === 'ACTIVE' ? 'BANNED' : 'ACTIVE'
                              ),
                            user.status === 'ACTIVE' ? 'Account banned' : 'Account restored'
                          )
                        }
                      >
                        {user.status === 'ACTIVE' ? 'Ban' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!activeList.loading && isArtisanView && artisansList.items.length > 0 && (
          <div className="admin-table-scroll-wrap admin-profiles-table-wrap">
            <AdminTableScrollHint />
            <table className="admin-profiles-table admin-data-table">
              <thead>
                <tr>
                  <th scope="col">Artisan</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Location</th>
                  <th scope="col">Verification</th>
                  <th scope="col">Rating</th>
                  <th scope="col">Activity</th>
                  <th scope="col">Photos</th>
                </tr>
              </thead>
              <tbody>
                {artisansList.items.map((artisan) => {
                  const photoCount =
                    artisan._count?.portfolioImages ?? artisan.portfolioImages?.length ?? 0;
                  const expanded = expandedArtisanId === artisan.id;

                  return (
                    <Fragment key={artisan.id}>
                      <tr>
                        <td data-label="Artisan">
                          <strong>{artisan.displayName}</strong>
                          <span className="admin-profiles-meta">
                            {artisan.user?.status?.toLowerCase() || 'unknown'} account
                          </span>
                        </td>
                        <td data-label="Contact">
                          {artisan.user?.email || artisan.user?.phone || '—'}
                        </td>
                        <td data-label="Location">
                          {[artisan.area, artisan.city].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td data-label="Verification">
                          <select
                            className="admin-inline-select"
                            value={artisan.verifyStatus}
                            disabled={busy}
                            aria-label={`Verification for ${artisan.displayName}`}
                            onChange={(event) =>
                              void runAction(
                                () =>
                                  updateVerification(
                                    artisan.id,
                                    event.target.value as Artisan['verifyStatus']
                                  ),
                                `Verification set to ${event.target.value.toLowerCase()}`
                              )
                            }
                          >
                            <option value="PENDING">Pending</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                          </select>
                        </td>
                        <td data-label="Rating">
                          {artisan.avgRating.toFixed(1)} ({artisan.ratingCount})
                        </td>
                        <td data-label="Activity">
                          {artisan._count?.offerings || 0} offers ·{' '}
                          {artisan._count?.bookingsReceived || 0} jobs
                        </td>
                        <td data-label="Photos">
                          {photoCount > 0 ? (
                            <button
                              type="button"
                              className="text-button admin-profiles-action"
                              onClick={() =>
                                setExpandedArtisanId(expanded ? null : artisan.id)
                              }
                            >
                              {photoCount} {expanded ? 'Hide' : 'View'}
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                      {expanded && photoCount > 0 && (
                        <tr key={`${artisan.id}-photos`} className="admin-profiles-expand-row">
                          <td colSpan={7}>
                            <AdminPortfolioGallery
                              images={artisan.portfolioImages ?? []}
                              artisanName={artisan.displayName}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={activeList.page}
          limit={activeList.limit}
          total={activeList.total}
          busy={busy || activeList.loading}
          onPageChange={activeList.setPage}
        />
      </article>
    </section>
  );
}
