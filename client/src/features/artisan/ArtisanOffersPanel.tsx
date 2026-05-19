import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ActionRunner } from '../../appTypes';
import { api } from '../../lib/api';
import { money } from '../../lib/formatting';
import type { Artisan, ArtisanKycSubmission, Offering } from '../../types';

export function ArtisanOffersPanel({
  token,
  categories,
  offerings,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  categories: ReactNode[];
  offerings: Offering[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [kycSubmission, setKycSubmission] = useState<ArtisanKycSubmission | null>(null);
  const kycStatus = kycSubmission?.status ?? 'NOT_SUBMITTED';
  const artisanApproved = profile?.verifyStatus === 'APPROVED' && kycStatus === 'APPROVED';
  const reviewMessage = !profile
    ? 'Create your artisan profile in Profile settings before listing services.'
    : kycStatus === 'APPROVED' && profile.verifyStatus !== 'APPROVED'
      ? 'Your KYC is approved. Admin approval for your artisan profile is still pending.'
      : kycStatus === 'APPROVED'
        ? 'Your artisan account is approved. Add service offers that match your profile.'
        : 'Service offers unlock after KYC and admin approval.';

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }).catch(() => ({ submission: null })),
    ]).then(([profileResponse, kycResponse]) => {
      if (!mounted) return;
      setProfile(profileResponse.profile || null);
      setKycSubmission(kycResponse.submission);
    });
    return () => {
      mounted = false;
    };
  }, [token]);

  async function createOffering(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    await api('/offerings', {
      method: 'POST',
      token,
      body: JSON.stringify({
        categoryId: form.get('categoryId'),
        title: form.get('title'),
        description: form.get('description'),
        priceFrom: Number(form.get('priceFrom')),
        priceTo: form.get('priceTo') ? Number(form.get('priceTo')) : undefined,
      }),
    });
    await refresh();
    formElement.reset();
  }

  return (
    <>
      <section className="section-head compact">
        <p className="eyebrow">Services</p>
        <h1>Service offers</h1>
        <p>{reviewMessage}</p>
      </section>

      {!artisanApproved && (
        <article className="panel-card locked-card">
          <p className="eyebrow">Locked until approval</p>
          <h2>Offer creation is not available yet</h2>
          <div className="approval-steps">
            <span className={profile ? 'complete' : ''}>Profile</span>
            <span className={kycStatus !== 'NOT_SUBMITTED' ? 'complete' : ''}>KYC submitted</span>
            <span className={kycStatus === 'APPROVED' ? 'complete' : ''}>KYC approved</span>
            <span className={profile?.verifyStatus === 'APPROVED' ? 'complete' : ''}>Admin approved</span>
          </div>
        </article>
      )}

      {artisanApproved && (
        <form
          className="panel-card form-card"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            runAction(() => createOffering(form), 'Offering created');
          }}
        >
          <p className="eyebrow">Create offer</p>
          <h2>Add a service package</h2>
          <select name="categoryId" required>{categories}</select>
          <input name="title" placeholder="Service title" required />
          <input name="description" placeholder="Description" />
          <input name="priceFrom" placeholder="Price from" required />
          <input name="priceTo" placeholder="Price to" />
          <button disabled={busy}>Create offering</button>
        </form>
      )}

      <article className="panel-card">
        <p className="eyebrow">Services</p>
        <h2>My offerings</h2>
        {offerings.length === 0 && <p>No offerings created yet.</p>}
        {offerings.map((offering) => (
          <div className="list-item" key={offering.id}>
            <strong>{offering.title}</strong>
            <span>
              {money(offering.priceFrom)}
              {offering.category?.name ? ` · ${offering.category.name}` : ''}
            </span>
          </div>
        ))}
      </article>
    </>
  );
}

