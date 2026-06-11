import { useEffect, useState } from 'react';
import { KycImageUploadField } from '../../components/KycImageUploadField';
import { api } from '../../lib/api';
import { kycStatusLabel } from '../../lib/artisanVerification';
import { nigeriaStates } from '../../lib/geo';
import { uploadKycImage } from '../../lib/kycUpload';
import type { ActionRunner } from '../../appTypes';
import type { ArtisanKycSubmission } from '../../types';

function formatDocumentType(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function maskDocumentNumber(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 4) {
    return '••••';
  }

  return `•••• ${trimmed.slice(-4)}`;
}

function formatDate(value?: string | null) {
  if (!value) return 'Not recorded';

  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function ArtisanKycSection({
  token,
  busy,
  runAction,
  refresh,
  profileCity,
}: {
  token: string;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  profileCity?: string | null;
}) {
  const [kycSubmission, setKycSubmission] = useState<ArtisanKycSubmission | null>(null);

  useEffect(() => {
    let mounted = true;
    void api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token })
      .then((response) => {
        if (mounted) {
          setKycSubmission(response.submission);
        }
      })
      .catch(() => {
        if (mounted) {
          setKycSubmission(null);
        }
      });
    return () => {
      mounted = false;
    };
  }, [token]);

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

  const locked =
    kycSubmission?.status === 'APPROVED' || kycSubmission?.status === 'PENDING';
  const approved = kycSubmission?.status === 'APPROVED';

  if (kycSubmission && locked) {
    return (
      <section className="artisan-settings-card kyc-status-card" aria-labelledby="kyc-status-heading">
        <div className={`kyc-status-banner ${approved ? 'approved' : 'pending'}`}>
          <p className="eyebrow">Identity verification</p>
          <h2 id="kyc-status-heading">
            {approved ? 'Your KYC is approved' : 'Your KYC is under review'}
          </h2>
          <p>
            {approved
              ? 'Your identity has been verified. These details are locked to protect your account and payout security.'
              : 'Your documents have been submitted. We will notify you when review is complete or if anything needs updating.'}
          </p>
          <span className="kyc-status-pill">{kycStatusLabel(kycSubmission.status)}</span>
        </div>

        <dl className="kyc-summary-list">
          <div>
            <dt>Legal name</dt>
            <dd>{kycSubmission.legalName}</dd>
          </div>
          <div>
            <dt>Document type</dt>
            <dd>{formatDocumentType(kycSubmission.documentType)}</dd>
          </div>
          <div>
            <dt>Document number</dt>
            <dd>{maskDocumentNumber(kycSubmission.documentNumber)}</dd>
          </div>
          <div>
            <dt>City</dt>
            <dd>{kycSubmission.city}</dd>
          </div>
          <div>
            <dt>{approved ? 'Approved on' : 'Submitted on'}</dt>
            <dd>{formatDate(approved ? kycSubmission.reviewedAt : kycSubmission.submittedAt)}</dd>
          </div>
        </dl>

        {kycSubmission.reviewNote && (
          <div className="payment-note success">
            <strong>Reviewer note</strong>
            <span>{kycSubmission.reviewNote}</span>
          </div>
        )}

        <p className="muted kyc-locked-note">
          Need to correct verified identity details? Contact Bundo support so the change can be handled securely.
        </p>
      </section>
    );
  }

  return (
    <form
      className="account-settings-form artisan-settings-card"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        void runAction(() => submitKyc(form), 'Verification details saved');
      }}
    >
      <h2>Identity verification (KYC)</h2>
      <p className="muted">
        Submit your identity details for review. If our team requests changes, update the details here and resubmit.
      </p>
      {kycSubmission && (
        <div className={`payment-note ${kycSubmission.status === 'APPROVED' ? 'success' : ''}`}>
          <strong>Status: {kycStatusLabel(kycSubmission.status)}</strong>
          <span>{kycSubmission.reviewNote || 'Update the requested details and submit again for review.'}</span>
        </div>
      )}
      <label>
        Legal name
        <input name="legalName" defaultValue={kycSubmission?.legalName || ''} required />
      </label>
      <label>
        Document type
        <select name="documentType" defaultValue={kycSubmission?.documentType || 'NIN'} required>
          <option value="NIN">NIN</option>
          <option value="BVN">BVN</option>
          <option value="DRIVERS_LICENSE">Driver&apos;s license</option>
          <option value="INTERNATIONAL_PASSPORT">International passport</option>
        </select>
      </label>
      <label>
        Document number
        <input name="documentNumber" defaultValue={kycSubmission?.documentNumber || ''} required />
      </label>
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
      <label>
        Residential address
        <input name="address" defaultValue={kycSubmission?.address || ''} required />
      </label>
      <label>
        State
        <select name="city" defaultValue={kycSubmission?.city || profileCity || 'Lagos'} required>
          {nigeriaStates.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={busy}>
        {kycSubmission ? 'Resubmit verification details' : 'Submit verification details'}
      </button>
    </form>
  );
}
