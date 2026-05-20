import { useEffect, useState } from 'react';
import { KycImageUploadField } from '../../components/KycImageUploadField';
import { api } from '../../lib/api';
import { uploadKycImage } from '../../lib/kycUpload';
import type { ActionRunner } from '../../appTypes';
import type { ArtisanKycSubmission } from '../../types';

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
        Submit or update your identity details. Admin reviews these before your profile is fully approved and payouts
        can proceed.
      </p>
      {kycSubmission && (
        <div className={`payment-note ${kycSubmission.status === 'APPROVED' ? 'success' : ''}`}>
          <strong>Status: {kycSubmission.status.toLowerCase().replace(/_/g, ' ')}</strong>
          <span>{kycSubmission.reviewNote || 'Our team will review your submission.'}</span>
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
        City
        <input name="city" defaultValue={kycSubmission?.city || profileCity || 'Lagos'} required />
      </label>
      <button type="submit" disabled={busy}>
        Save verification details
      </button>
    </form>
  );
}
