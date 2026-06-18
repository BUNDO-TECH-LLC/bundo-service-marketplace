import { useState } from 'react';
import { formatNinInput } from '../../../lib/kycValidation';
import { MAX_IMAGE_BYTES, validateImageFileForPick } from '../../../lib/imageFile';
import type { ArtisanLandingModel } from './artisanLandingTypes';

export function ArtisanLandingStepVerify({ landing }: { landing: ArtisanLandingModel }) {
  const {
    setup,
    updateSetup,
    kycDocumentFile,
    setKycDocumentFile,
    submitAgreed,
    setSubmitAgreed,
    busy,
  } = landing;
  const [uploadError, setUploadError] = useState('');

  return (
    <section className="artisan-setup-card availability-step">
      <div className="booking-payment-notice" role="status">
        Your profile and availability are saved. Finish identity verification so our team can approve your
        listing.
      </div>

      <h2>Verify your identity</h2>
      <p>This step is reviewed by our team before your profile goes live.</p>

      <label>
        Residential address<span>*</span>
        <input
          value={setup.address}
          onChange={(event) => updateSetup('address', event.target.value)}
          placeholder="Address for manual verification"
          required
        />
      </label>

      <label>
        NIN (11 digits)<span>*</span>
        <input
          value={setup.documentNumber}
          onChange={(event) => updateSetup('documentNumber', formatNinInput(event.target.value))}
          placeholder="12345678901"
          inputMode="numeric"
          pattern="\d{11}"
          maxLength={11}
          autoComplete="off"
          required
        />
        <small className="muted">
          Enter your 11-digit National Identification Number exactly as on your NIN slip.
        </small>
      </label>

      <label>
        NIN slip or ID photo<span>*</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;

            const validationError = validateImageFileForPick(file);
            if (validationError) {
              setUploadError(validationError);
              setKycDocumentFile(null);
              event.currentTarget.value = '';
              return;
            }

            setUploadError('');
            setKycDocumentFile(file);
            event.currentTarget.value = '';
          }}
        />
        <small className="muted">
          Take a clear photo of your NIN slip or government ID (max {Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}
          MB).
        </small>
      </label>

      {kycDocumentFile && <p className="muted">Selected: {kycDocumentFile.name}</p>}
      {uploadError && (
        <p className="form-error" role="alert">
          {uploadError}{' '}
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setUploadError('');
              setKycDocumentFile(null);
            }}
          >
            Try again
          </button>
        </p>
      )}

      <label className="terms-row">
        <input
          type="checkbox"
          checked={submitAgreed}
          onChange={(event) => setSubmitAgreed(event.target.checked)}
        />{' '}
        <span>I confirm these details are accurate and ready for admin review.</span>
      </label>
    </section>
  );
}
