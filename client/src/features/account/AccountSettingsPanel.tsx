import type { ActionRunner } from '../../appTypes';
import { api } from '../../lib/api';
import type { ApiUser } from '../../types';

export function AccountSettingsPanel({
  token,
  me,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  me: ApiUser;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const canApplyAsArtisan = me.role !== 'ARTISAN' && me.role !== 'ADMIN';

  return (
    <article className="panel-card">
      <p className="eyebrow">Profile settings</p>
      <h2>Account type</h2>
      <p>
        Current account: <strong>{me.role ? me.role.toLowerCase() : 'not selected'}</strong>
      </p>
      {me.role === 'ARTISAN' ? (
        <p className="muted">
          Artisan access is controlled by KYC and admin approval. Complete verification
          before listing services.
        </p>
      ) : me.role === 'ADMIN' ? (
        <p className="muted">Admin access is managed from the admin console.</p>
      ) : (
        <p className="muted">
          Client accounts can apply to become artisans. Listing services remains locked
          until profile setup, KYC, and admin approval are complete.
        </p>
      )}
      {canApplyAsArtisan && (
        <div className="actions">
          {!me.role && (
            <button
              disabled={busy}
              onClick={() =>
                runAction(async () => {
                  await api('/users/role', {
                    method: 'PATCH',
                    token,
                    body: JSON.stringify({ role: 'CUSTOMER' }),
                  });
                  await refresh();
                }, 'Client account selected')
              }
            >
              Continue as client
            </button>
          )}
          <button
            disabled={busy}
            onClick={() =>
              runAction(async () => {
                await api('/users/role', {
                  method: 'PATCH',
                  token,
                  body: JSON.stringify({ role: 'ARTISAN' }),
                });
                await refresh();
              }, 'Artisan application started')
            }
          >
            Apply as artisan
          </button>
        </div>
      )}
    </article>
  );
}

