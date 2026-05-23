import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { dayLabels, money } from '../../lib/formatting';
import type { ActionRunner } from '../../appTypes';
import {
  createAvailabilitySlot,
  deleteAvailabilitySlot,
  fetchMyAvailabilitySlots,
} from '../../lib/availabilitySlots';
import {
  deletePortfolioImage,
  fetchMyPortfolioImages,
  uploadPortfolioImage,
} from '../../lib/portfolioUpload';
import type {
  Artisan,
  ArtisanKycSubmission,
  AvailabilitySlot,
  Category,
  Offering,
  PayoutBank,
  PortfolioImage,
  ProviderPayoutAccount,
} from '../../types';

type ArtisanToolsPageProps = {
  token: string;
  categories: Category[];
  offerings: Offering[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
};

export function ArtisanToolsPage({
  token,
  categories,
  offerings,
  busy,
  runAction,
  refresh,
}: ArtisanToolsPageProps) {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [portfolioImages, setPortfolioImages] = useState<PortfolioImage[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [payoutAccount, setPayoutAccount] = useState<ProviderPayoutAccount | null>(null);
  const [banks, setBanks] = useState<PayoutBank[]>([]);
  const [kycSubmission, setKycSubmission] = useState<ArtisanKycSubmission | null>(null);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);

  const kycStatus = kycSubmission?.status ?? 'NOT_SUBMITTED';
  const artisanApproved = profile?.verifyStatus === 'APPROVED' && kycStatus === 'APPROVED';
  const reviewMessage = !profile
    ? 'Create your artisan profile first, then submit KYC for admin review.'
    : kycStatus === 'NOT_SUBMITTED'
      ? 'Submit KYC so admin can verify your identity before you list services.'
      : kycStatus === 'APPROVED' && profile.verifyStatus !== 'APPROVED'
        ? 'Your KYC is approved. Admin approval for your artisan profile is still pending.'
        : kycStatus === 'APPROVED'
          ? 'Your artisan account is approved. You can now create offers for matching categories.'
          : kycStatus === 'REJECTED'
            ? 'Your KYC was rejected. Review the admin note, update your details, and resubmit.'
            : kycStatus === 'CHANGES_REQUESTED'
              ? 'Admin requested changes. Update your KYC details and resubmit for review.'
              : 'Your KYC is under admin review. Offer creation unlocks after approval.';

  useEffect(() => {
    let mounted = true;

    Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      fetchMyPortfolioImages(token).catch(() => [] as PortfolioImage[]),
      fetchMyAvailabilitySlots(token).catch(() => [] as AvailabilitySlot[]),
      api<{ account: ProviderPayoutAccount | null }>('/artisans/payout-account', { token }),
      api<{ banks: PayoutBank[] }>('/payments/banks', { token }),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }),
    ])
      .then(([profileResponse, imageResponse, slotResponse, accountResponse, bankResponse, kycResponse]) => {
        if (!mounted) {
          return;
        }

        setProfile(profileResponse.profile || null);
        setPortfolioImages(imageResponse);
        setAvailabilitySlots(slotResponse);
        setPayoutAccount(accountResponse.account);
        setBanks(bankResponse.banks);
        setKycSubmission(kycResponse.submission);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }

        setProfile(null);
        setPortfolioImages([]);
        setAvailabilitySlots([]);
        setPayoutAccount(null);
        setBanks([]);
        setKycSubmission(null);
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  async function hydrateWorkspace() {
    const [profileResponse, imageResponse, slotResponse, accountResponse, kycResponse] = await Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      fetchMyPortfolioImages(token).catch(() => [] as PortfolioImage[]),
      fetchMyAvailabilitySlots(token).catch(() => [] as AvailabilitySlot[]),
      api<{ account: ProviderPayoutAccount | null }>('/artisans/payout-account', { token }),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }),
    ]);

    setProfile(profileResponse.profile || null);
    setPortfolioImages(imageResponse);
    setAvailabilitySlots(slotResponse);
    setPayoutAccount(accountResponse.account);
    setKycSubmission(kycResponse.submission);
  }

  async function createProfile(formElement: HTMLFormElement) {
    const form = new FormData(formElement);

    await api('/artisans/profile', {
      method: profile ? 'PATCH' : 'POST',
      token,
      body: JSON.stringify({
        displayName: form.get('displayName'),
        bio: form.get('bio'),
        city: form.get('city'),
        area: form.get('area'),
        lat: Number(form.get('lat')),
        lng: Number(form.get('lng')),
      }),
    });

    await refresh();
    await hydrateWorkspace();
  }

  async function savePayoutAccount(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const selectedBank = banks.find((bank) => bank.code === String(form.get('bankCode') || ''));

    const response = await api<{ account: ProviderPayoutAccount }>('/artisans/payout-account', {
      method: 'POST',
      token,
      body: JSON.stringify({
        bankCode: form.get('bankCode'),
        bankName: selectedBank?.name,
        accountNumber: form.get('accountNumber'),
        accountName: form.get('accountName'),
      }),
    });

    setPayoutAccount(response.account);
  }

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

  async function addAvailability(formElement: HTMLFormElement) {
    const form = new FormData(formElement);

    await createAvailabilitySlot(token, {
      dayOfWeek: Number(form.get('dayOfWeek')),
      startTime: String(form.get('startTime')),
      endTime: String(form.get('endTime')),
    });

    await hydrateWorkspace();
    formElement.reset();
  }

  async function toggleAvailability(slot: AvailabilitySlot) {
    await api(`/artisans/availability-slots/${slot.id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        isActive: !slot.isActive,
      }),
    });

    await hydrateWorkspace();
  }

  async function removeAvailability(slotId: string) {
    await deleteAvailabilitySlot(token, slotId);
    await hydrateWorkspace();
  }

  async function uploadPortfolioFile(file: File) {
    setUploadingPortfolio(true);

    try {
      await uploadPortfolioImage(token, file, portfolioImages.length);
      await hydrateWorkspace();
    } finally {
      setUploadingPortfolio(false);
    }
  }

  async function removePortfolioImageById(imageId: string) {
    await deletePortfolioImage(token, imageId);
    await hydrateWorkspace();
  }

  async function submitKyc(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const response = await api<{ submission: ArtisanKycSubmission }>('/artisans/kyc', {
      method: 'POST',
      token,
      body: JSON.stringify({
        legalName: form.get('legalName'),
        documentType: form.get('documentType'),
        documentNumber: form.get('documentNumber'),
        documentImageUrl: form.get('documentImageUrl'),
        selfieImageUrl: form.get('selfieImageUrl') || undefined,
        address: form.get('address'),
        city: form.get('city'),
      }),
    });

    setKycSubmission(response.submission);
  }

  return (
    <div className="grid gap-5">
      <form
        className="panel-card form-card"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          void runAction(() => createProfile(form), 'Artisan profile saved');
        }}
      >
        <p className="eyebrow">Onboarding</p>
        <h2>Artisan profile</h2>
        <input name="displayName" placeholder="Display name" defaultValue={profile?.displayName || ''} required />
        <input name="bio" placeholder="Bio" defaultValue={profile?.bio || ''} />
        <input name="city" placeholder="City" defaultValue={profile?.city || 'Lagos'} required />
        <input name="area" placeholder="Area" defaultValue={profile?.area || 'Lekki'} />
        <input name="lat" placeholder="Latitude" defaultValue={profile?.lat ?? '6.5244'} required />
        <input name="lng" placeholder="Longitude" defaultValue={profile?.lng ?? '3.3792'} required />
        <button disabled={busy}>{profile ? 'Update profile' : 'Save profile'}</button>
      </form>

      <form
        className="panel-card form-card"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          void runAction(() => submitKyc(form), 'KYC submission saved');
        }}
      >
        <p className="eyebrow">Compliance</p>
        <h2>KYC submission</h2>
        <p>Submit your identity details so Bundo can review your artisan account before broader rollout.</p>
        {kycSubmission ? (
          <div className={`payment-note ${kycSubmission.status === 'APPROVED' ? 'success' : ''}`}>
            <strong>KYC status: {kycSubmission.status.toLowerCase().replace(/_/g, ' ')}</strong>
            <span>{kycSubmission.reviewNote ? kycSubmission.reviewNote : 'We will update you once the review is complete.'}</span>
          </div>
        ) : null}
        <input name="legalName" placeholder="Legal name" defaultValue={kycSubmission?.legalName || ''} required />
        <select name="documentType" defaultValue={kycSubmission?.documentType || 'NIN'} required>
          <option value="NIN">NIN</option>
          <option value="BVN">BVN</option>
          <option value="DRIVERS_LICENSE">Driver&apos;s license</option>
          <option value="INTERNATIONAL_PASSPORT">International passport</option>
        </select>
        <input name="documentNumber" placeholder="Document number" defaultValue={kycSubmission?.documentNumber || ''} required />
        <input name="documentImageUrl" placeholder="Document image URL" defaultValue={kycSubmission?.documentImageUrl || ''} required />
        <input name="selfieImageUrl" placeholder="Selfie image URL" defaultValue={kycSubmission?.selfieImageUrl || ''} />
        <input name="address" placeholder="Residential address" defaultValue={kycSubmission?.address || ''} required />
        <input name="city" placeholder="City" defaultValue={kycSubmission?.city || 'Lagos'} required />
        <button disabled={busy}>Submit KYC</button>
      </form>

      {!artisanApproved ? (
        <article className="panel-card locked-card">
          <p className="eyebrow">Locked until approval</p>
          <h2>Offers are not available yet</h2>
          <p>{reviewMessage}</p>
          <div className="approval-steps">
            <span className={profile ? 'complete' : ''}>Profile</span>
            <span className={kycStatus !== 'NOT_SUBMITTED' ? 'complete' : ''}>KYC submitted</span>
            <span className={kycStatus === 'APPROVED' ? 'complete' : ''}>KYC approved</span>
            <span className={profile?.verifyStatus === 'APPROVED' ? 'complete' : ''}>Admin approved</span>
          </div>
        </article>
      ) : (
        <>
          <form
            className="panel-card form-card"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              void runAction(() => createOffering(form), 'Offering created');
            }}
          >
            <p className="eyebrow">Services</p>
            <h2>Create offering</h2>
            <select name="categoryId" required>
              <option value="" disabled>
                Select category
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <input name="title" placeholder="Service title" required />
            <input name="description" placeholder="Description" />
            <input name="priceFrom" placeholder="Price from" required />
            <input name="priceTo" placeholder="Price to" />
            <button disabled={busy}>Create offering</button>
          </form>

          <form
            className="panel-card form-card"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              void runAction(() => savePayoutAccount(form), 'Payout account saved');
            }}
          >
            <p className="eyebrow">Payments</p>
            <h2>Payout account</h2>
            <p>Add the Nigerian bank account where completed-service payouts should be sent.</p>
            {payoutAccount ? (
              <div className="payment-note success">
                <strong>{payoutAccount.accountName || 'Verified account'}</strong>
                <span>{payoutAccount.bankName || payoutAccount.bankCode} · {payoutAccount.accountNumber}</span>
              </div>
            ) : null}
            <select name="bankCode" defaultValue={payoutAccount?.bankCode || ''} required>
              <option value="" disabled>
                Select bank
              </option>
              {banks.map((bank) => (
                <option key={bank.code} value={bank.code}>
                  {bank.name}
                </option>
              ))}
            </select>
            <input name="accountNumber" placeholder="Account number" defaultValue={payoutAccount?.accountNumber || ''} required />
            <input name="accountName" placeholder="Account name" defaultValue={payoutAccount?.accountName || ''} />
            <button disabled={busy}>Save payout account</button>
          </form>

          <article className="panel-card">
            <p className="eyebrow">Services</p>
            <h2>My offerings</h2>
            {offerings.length === 0 ? <p>No offerings created yet.</p> : null}
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

          <article className="panel-card form-card">
            <p className="eyebrow">Portfolio</p>
            <h2>Upload work samples</h2>
            <p>Add a few clean job photos so customers can trust what you do before they book.</p>
            <label className="upload-field">
              <span>Choose image</span>
              <input
                type="file"
                accept="image/*"
                disabled={busy || uploadingPortfolio}
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (!file) {
                    return;
                  }

                  void runAction(() => uploadPortfolioFile(file), 'Portfolio image uploaded');
                  event.currentTarget.value = '';
                }}
              />
            </label>
            <div className="workspace-media-grid">
              {portfolioImages.length === 0 ? <p className="muted">No portfolio images uploaded yet.</p> : null}
              {portfolioImages.map((image) => (
                <div className="workspace-media-card" key={image.id}>
                  <img src={image.url} alt="Portfolio upload" />
                  <button
                    className="secondary-button"
                    disabled={busy || uploadingPortfolio}
                    onClick={() => void runAction(() => removePortfolioImageById(image.id), 'Portfolio image removed')}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </article>

          <article className="panel-card form-card">
            <p className="eyebrow">Availability</p>
            <h2>Working hours</h2>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                void runAction(() => addAvailability(form), 'Availability added');
              }}
            >
              <select name="dayOfWeek" defaultValue="1" required>
                {dayLabels.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
              <input name="startTime" type="time" defaultValue="09:00" required />
              <input name="endTime" type="time" defaultValue="17:00" required />
              <button disabled={busy}>Add slot</button>
            </form>
            {availabilitySlots.length === 0 ? <p className="muted">No availability slots yet.</p> : null}
            {availabilitySlots.map((slot) => (
              <div className="list-item" key={slot.id}>
                <strong>
                  {dayLabels[slot.dayOfWeek]} · {slot.startTime} - {slot.endTime}
                </strong>
                <span>{slot.isActive ? 'Active' : 'Paused'}</span>
                <div className="actions">
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() =>
                      void runAction(
                        () => toggleAvailability(slot),
                        slot.isActive ? 'Availability paused' : 'Availability activated'
                      )
                    }
                  >
                    {slot.isActive ? 'Pause' : 'Activate'}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => void runAction(() => removeAvailability(slot.id), 'Availability removed')}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </article>
        </>
      )}
    </div>
  );
}
