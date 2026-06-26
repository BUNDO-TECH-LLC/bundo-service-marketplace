import { FormEvent, useState } from 'react';
import { ArtisanLocationField } from '../components/ArtisanLocationField';
import { api } from '../lib/api';
import {
  artisanLocationFromCatalogItem,
  profileLocationFromUser,
  type ArtisanLocationSelection,
} from '../lib/artisanLocationSelection';
import { shouldSeedBrowseFromProfile } from '../lib/syncBrowseLocationFromProfile';
import { useAppRoot } from '../app/appRootContext';
import type { ApiUser } from '../types';

const fieldClassName =
  'w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-base text-[var(--color-ink)] outline-none transition-shadow focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20';

const labelClassName = 'grid gap-2 text-sm font-medium text-[var(--color-ink-muted)]';

export default function CustomerProfilePage() {
  const ctx = useAppRoot();
  const email = ctx.firebaseUser?.email || ctx.me?.email || '';
  const [phone, setPhone] = useState(ctx.me?.phone?.replace(/^\+234/, '') || '');
  const [locationSelection, setLocationSelection] = useState<ArtisanLocationSelection>(() =>
    ctx.me ? profileLocationFromUser(ctx.me) : profileLocationFromUser({ state: '', area: '' })
  );
  const [address, setAddress] = useState(ctx.me?.address || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const normalizedPhone = phone.trim().startsWith('+')
      ? phone.trim()
      : `+234${phone.replace(/\D/g, '')}`;

    if (!normalizedPhone || normalizedPhone.length < 12) {
      setError('Enter a valid Nigerian phone number.');
      return;
    }

    if (!locationSelection.state.trim()) {
      setError('Select your state and area.');
      return;
    }

    setBusy(true);
    const seedBrowseLocation = shouldSeedBrowseFromProfile(ctx.me);

    try {
      const response = await api<{ user: ApiUser }>('/users/profile', {
        method: 'PATCH',
        token: ctx.token,
        body: JSON.stringify({
          phone: normalizedPhone,
          locationId: locationSelection.locationId || undefined,
          state: locationSelection.state,
          area: locationSelection.area || undefined,
          address: address.trim() || undefined,
        }),
      });

      ctx.acknowledgeSession(ctx.token, response.user);
      if (seedBrowseLocation) {
        ctx.applyProfileLocation(response.user.state ?? '', response.user.area, {
          locationId: response.user.locationId,
          lat: response.user.locationLat,
          lng: response.user.locationLng,
        });
      }
      ctx.setNotice('Profile saved. Welcome to Bundo!');
      ctx.navigate('/marketplace', { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="customer-profile-page mx-auto grid min-h-[calc(100dvh-72px)] w-full max-w-xl place-items-center px-4 py-8 sm:px-6 sm:py-10">
      <section className="grid w-full gap-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-white)] p-6 shadow-[0_24px_80px_var(--shadow-modal)] sm:p-8">
        <div className="grid gap-3 text-center">
          <p className="m-0 text-xs font-bold uppercase tracking-[0.28em] text-[var(--color-primary)]">
            Almost there
          </p>
          <h1 className="m-0 text-[1.75rem] font-semibold leading-tight text-[var(--color-ink)] sm:text-[2rem]">
            Complete your profile
          </h1>
          <p className="m-0 text-base leading-relaxed text-[var(--color-text-sub)]">
            Tell us how to reach you and where you need services so we can show relevant artisans nearby.
          </p>
        </div>

        <form className="grid gap-5" onSubmit={(event) => void handleSubmit(event)}>
          <label className={labelClassName}>
            Email
            <input
              type="email"
              value={email}
              readOnly
              aria-readonly="true"
              className={`${fieldClassName} cursor-default bg-[var(--color-page)] text-[var(--color-text-sub)]`}
            />
          </label>

          <label className={labelClassName}>
            Phone number
            <div className="flex overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20">
              <span className="flex items-center border-r border-[var(--color-border)] bg-[var(--color-page)] px-4 text-sm font-semibold text-[var(--color-ink-muted)]">
                +234
              </span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="8012345678"
                autoComplete="tel-national"
                required
                className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3.5 text-base outline-none"
              />
            </div>
          </label>

          <label className={labelClassName}>
            Location
            <ArtisanLocationField
              locationLabel={locationSelection.locationLabel || 'Select state and area'}
              disabled={busy}
              onSelect={(item) => setLocationSelection(artisanLocationFromCatalogItem(item))}
            />
          </label>

          <label className={labelClassName}>
            <span>
              Address{' '}
              <span className="font-normal text-[var(--color-text-sub)]">(optional)</span>
            </span>
            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Street or landmark to help artisans find you"
              rows={3}
              maxLength={200}
              className={`${fieldClassName} min-h-[96px] resize-y`}
            />
          </label>

          {error && (
            <p
              className="m-0 rounded-xl bg-[var(--color-danger-wash)] px-4 py-3 text-sm font-medium text-[var(--color-danger-dark)]"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 h-14 w-full rounded-[15px] bg-[var(--color-primary)] text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save and continue'}
          </button>
        </form>
      </section>
    </main>
  );
}
