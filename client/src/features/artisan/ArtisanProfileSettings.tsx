import { useEffect, useState } from 'react';
import { signOut, User } from 'firebase/auth';
import type { ActionRunner } from '../../appTypes';
import { ArtisanAvailabilityEditor } from '../../components/ArtisanAvailabilityEditor';
import { ArtisanPortfolioManager } from '../../components/ArtisanPortfolioManager';
import { KycImageUploadField } from '../../components/KycImageUploadField';
import { api } from '../../lib/api';
import { auth } from '../../lib/firebase';
import { uploadKycImage } from '../../lib/kycUpload';
import { useArtisanPortfolio } from '../../lib/useArtisanPortfolio';
import type {
  Artisan,
  ArtisanKycSubmission,
  PayoutBank,
  ProviderPayoutAccount,
} from '../../types';

type ProfileSettingsSection = 'profile' | 'photos' | 'availability' | 'kyc' | 'bank';

export function ArtisanProfileSettings({
  token,
  firebaseUser,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  firebaseUser: User | null;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const [activeSection, setActiveSection] = useState<ProfileSettingsSection>('profile');
  const [profileFormKey, setProfileFormKey] = useState(0);
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [payoutAccount, setPayoutAccount] = useState<ProviderPayoutAccount | null>(null);
  const [banks, setBanks] = useState<PayoutBank[]>([]);
  const [kycSubmission, setKycSubmission] = useState<ArtisanKycSubmission | null>(null);
  const kycStatus = kycSubmission?.status ?? 'NOT_SUBMITTED';
  const approved = profile?.verifyStatus === 'APPROVED' && kycStatus === 'APPROVED';
  const {
    portfolioImages,
    uploadingPortfolio,
    uploadPortfolioFile,
    uploadPortfolioFiles,
    removePortfolioImage,
    reorderPortfolioImage,
  } = useArtisanPortfolio(token);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ account: ProviderPayoutAccount | null }>('/artisans/payout-account', { token }),
      api<{ banks: PayoutBank[] }>('/payments/banks', { token }),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }).catch(() => ({ submission: null })),
    ])
      .then(([profileResponse, accountResponse, bankResponse, kycResponse]) => {
        if (!mounted) return;
        setProfile(profileResponse.profile || null);
        setPayoutAccount(accountResponse.account);
        setBanks(bankResponse.banks);
        setKycSubmission(kycResponse.submission);
      })
      .catch(() => {
        if (!mounted) return;
        setProfile(null);
        setPayoutAccount(null);
        setBanks([]);
        setKycSubmission(null);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  async function hydrateSettings() {
    const [profileResponse, accountResponse, kycResponse] = await Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ account: ProviderPayoutAccount | null }>('/artisans/payout-account', { token }),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }).catch(() => ({ submission: null })),
    ]);
    setProfile(profileResponse.profile || null);
    setPayoutAccount(accountResponse.account);
    setKycSubmission(kycResponse.submission);
  }

  async function saveProfile(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    await api('/artisans/profile', {
      method: profile ? 'PATCH' : 'POST',
      token,
      body: JSON.stringify({
        displayName: form.get('displayName'),
        bio: profile?.bio || 'Bundo artisan',
        city: form.get('city'),
        area: form.get('area'),
        lat: profile?.lat ?? 6.5244,
        lng: profile?.lng ?? 3.3792,
      }),
    });
    const phone = String(form.get('phone') || '').trim();
    if (phone) {
      await api('/users/phone', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ phone }),
      });
    }

    const response = await api<{ profile: Artisan }>('/artisans/me', { token });
    setProfile(response.profile);
    await refresh();
  }

  async function submitKyc(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const documentImageUrl = String(form.get('documentImageUrl') || '').trim();
    if (!documentImageUrl) {
      throw new Error('Please upload your ID document photo.');
    }
    const selfieImageUrl = String(form.get('selfieImageUrl') || '').trim();
    const response = await api<{ submission: ArtisanKycSubmission }>('/artisans/kyc', {
      method: 'POST',
      token,
      body: JSON.stringify({
        legalName: form.get('legalName'),
        documentType: form.get('documentType'),
        documentNumber: form.get('documentNumber'),
        documentImageUrl,
        selfieImageUrl: selfieImageUrl || undefined,
        address: form.get('address'),
        city: form.get('city'),
      }),
    });
    setKycSubmission(response.submission);
    await refresh();
  }

  async function savePayoutAccount(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const selectedBank = banks.find(
      (bank) => bank.code === String(form.get('bankCode') || '')
    );
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
    await hydrateSettings();
  }

  const settingsSections: { id: ProfileSettingsSection; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'photos', label: 'Photos' },
    { id: 'availability', label: 'Availability' },
    { id: 'kyc', label: 'KYC' },
    { id: 'bank', label: 'Bank' },
  ];

  function goToSection(section: ProfileSettingsSection) {
    setActiveSection(section);
    document.getElementById(`settings-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function panelClass(section: ProfileSettingsSection) {
    return `artisan-settings-panel${activeSection === section ? ' is-active' : ''}`;
  }

  return (
    <section className="artisan-profile-settings-page">
      <header className="artisan-settings-hero">
        <div className="artisan-settings-hero-main">
          {portfolioImages[0] ? (
            <img className="profile-picture-preview" src={portfolioImages[0].url} alt="" />
          ) : (
            <span className="recommended-avatar large">{(profile?.displayName || 'A').slice(0, 1).toUpperCase()}</span>
          )}
          <div>
            <p className="eyebrow">Profile settings</p>
            <h1>{profile?.displayName || 'Your profile'}</h1>
            <p className="muted">{firebaseUser?.email || 'Artisan account'}</p>
            <span className={`booking-status ${approved ? 'completed' : 'pending'}`}>
              {approved ? 'Approved' : kycStatus.toLowerCase().replace(/_/g, ' ')}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="text-button artisan-settings-signout"
          onClick={() => {
            if (auth) {
              void signOut(auth);
            }
          }}
        >
          Log out
        </button>
      </header>

      <nav className="artisan-settings-subnav" aria-label="Profile sections">
        {settingsSections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={activeSection === section.id ? 'active' : ''}
            onClick={() => goToSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <div className="artisan-settings-stack">
        <form
          key={profileFormKey}
          id="settings-profile"
          className={`artisan-settings-card ${panelClass('profile')}`}
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            runAction(() => saveProfile(form), 'Profile saved');
          }}
        >
          <h2>Edit Personal Information</h2>
          <p>Update the public profile details customers see on Bundo.</p>
          <div className="profile-picture-row">
            {portfolioImages[0] ? (
              <img className="profile-picture-preview" src={portfolioImages[0].url} alt="" />
            ) : (
              <span className="recommended-avatar large">{(profile?.displayName || 'A').slice(0, 1).toUpperCase()}</span>
            )}
            <div>
              <strong>Profile picture</strong>
              <p className="muted">Your first photo in the gallery below is shown on your public profile.</p>
            </div>
          </div>
          <label>Full Name<input name="displayName" defaultValue={profile?.displayName || ''} required /></label>
          <label>Email Address<input defaultValue={firebaseUser?.email || ''} disabled /></label>
          <label>
            Phone number
            <input
              name="phone"
              defaultValue={firebaseUser?.phoneNumber || ''}
              placeholder="+2348012345678"
              title="Saved to your Bundo account"
            />
            <small className="muted">Update your contact number for booking and payout alerts.</small>
          </label>
          <label>Location<input name="city" defaultValue={profile?.city || 'Lagos'} required /></label>
          <label>Area<input name="area" defaultValue={profile?.area || ''} /></label>
          <div className="settings-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setProfileFormKey((value) => value + 1);
                void hydrateSettings();
              }}
            >
              Cancel
            </button>
            <button disabled={busy}>Save Changes</button>
          </div>
        </form>

        <div id="settings-photos" className={panelClass('photos')}>
        <ArtisanPortfolioManager
          variant="settings"
          portfolioImages={portfolioImages}
          busy={busy}
          uploadingPortfolio={uploadingPortfolio}
          runAction={runAction}
          uploadPortfolioFile={uploadPortfolioFile}
          uploadPortfolioFiles={uploadPortfolioFiles}
          removePortfolioImage={removePortfolioImage}
          reorderPortfolioImage={reorderPortfolioImage}
        />
        </div>

        <div id="settings-availability" className={panelClass('availability')}>
          <ArtisanAvailabilityEditor token={token} busy={busy} runAction={runAction} />
        </div>

        <form
          id="settings-kyc"
          className={`artisan-settings-card ${panelClass('kyc')}`}
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            runAction(() => submitKyc(form), 'KYC submission saved');
          }}
        >
          <h2>KYC verification</h2>
          <p>Identity details stay in settings and are reviewed by admin before your profile is fully approved.</p>
          {kycSubmission && (
            <div className={`payment-note ${kycSubmission.status === 'APPROVED' ? 'success' : ''}`}>
              <strong>KYC status: {kycSubmission.status.toLowerCase().replace(/_/g, ' ')}</strong>
              <span>{kycSubmission.reviewNote || 'Admin will review your submission.'}</span>
            </div>
          )}
          <label>Legal Name<input name="legalName" defaultValue={kycSubmission?.legalName || ''} required /></label>
          <label>Document Type
            <select name="documentType" defaultValue={kycSubmission?.documentType || 'NIN'} required>
              <option value="NIN">NIN</option>
              <option value="BVN">BVN</option>
              <option value="DRIVERS_LICENSE">Driver's license</option>
              <option value="INTERNATIONAL_PASSPORT">International passport</option>
            </select>
          </label>
          <label>Document Number<input name="documentNumber" defaultValue={kycSubmission?.documentNumber || ''} required /></label>
          <KycImageUploadField
            label="Document photo"
            name="documentImageUrl"
            hint="Upload a clear photo of your ID (JPG/PNG, max 5MB)."
            currentUrl={kycSubmission?.documentImageUrl}
            busy={busy}
            runAction={runAction}
            onUpload={(file) => uploadKycImage(token, file)}
            required={!kycSubmission?.documentImageUrl}
          />
          <KycImageUploadField
            label="Selfie (optional)"
            name="selfieImageUrl"
            hint="Optional selfie holding your ID."
            currentUrl={kycSubmission?.selfieImageUrl}
            busy={busy}
            runAction={runAction}
            onUpload={(file) => uploadKycImage(token, file)}
          />
          <label>Residential Address<input name="address" defaultValue={kycSubmission?.address || ''} required /></label>
          <label>City<input name="city" defaultValue={kycSubmission?.city || profile?.city || 'Lagos'} required /></label>
          <button disabled={busy}>Save KYC details</button>
        </form>

        <form
          id="settings-bank"
          className={`artisan-settings-card ${panelClass('bank')}`}
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            runAction(() => savePayoutAccount(form), 'Payout account saved');
          }}
        >
          <h2>Bank information</h2>
          <p>Add the Nigerian bank account where approved completed-service payouts should be sent.</p>
          {payoutAccount && (
            <div className="payment-note success">
              <strong>{payoutAccount.accountName || 'Saved payout account'}</strong>
              <span>
                {payoutAccount.bankName || payoutAccount.bankCode} · ****{payoutAccount.accountNumber.slice(-4)}
              </span>
            </div>
          )}
          <label>Bank
            <select name="bankCode" defaultValue={payoutAccount?.bankCode || ''} required>
              <option value="" disabled>Select bank</option>
              {banks.map((bank) => (
                <option key={bank.code} value={bank.code}>
                  {bank.name}
                </option>
              ))}
            </select>
          </label>
          <label>Account Number<input name="accountNumber" defaultValue={payoutAccount?.accountNumber || ''} required /></label>
          <label>Account Name<input name="accountName" defaultValue={payoutAccount?.accountName || ''} /></label>
          <button disabled={busy}>Save bank information</button>
        </form>
      </div>
    </section>
  );
}

