import { ArtisanSetupShell } from '../../../views/ArtisanSetupShell';
import { ARTISAN_SETUP_STEPS } from './artisanLandingTypes';
import type { ArtisanLandingModel } from './artisanLandingTypes';
import { ArtisanLandingStepBasic } from './ArtisanLandingStepBasic';
import { ArtisanLandingStepGoLive } from './ArtisanLandingStepGoLive';
import { ArtisanLandingStepService } from './ArtisanLandingStepService';
import { ArtisanLandingStepVerify } from './ArtisanLandingStepVerify';

const SAVED_NOTICE = 'Saved — you can come back anytime.';

export function ArtisanLandingSetupWizard({ landing }: { landing: ArtisanLandingModel }) {
  const {
    displayName,
    accountEmail,
    step,
    setStep,
    setupSubPhase,
    progressPercent,
    resumeMessage,
    busy,
    runAction,
    kycSubmission,
    setup,
    agreed,
    servicePackages,
    portfolioImages,
    uploadingPortfolio,
    selectedDays,
    submitAgreed,
    kycDocumentFile,
    saveBasicInfo,
    saveOffering,
    saveAvailabilityAndContinue,
    submitKycVerification,
    saveAndExit,
    backToGoLiveFromVerification,
  } = landing;

  const servicePackage = servicePackages[0];

  return (
    <ArtisanSetupShell displayName={displayName} email={accountEmail}>
      <main className="artisan-setup-page">
        <section className="artisan-setup-head">
          <div>
            <h1>Set up your artisan profile</h1>
            <p className="muted">
              Three quick steps to get listed. Identity verification is separate and reviewed by our team.
            </p>
          </div>
          <strong>{progressPercent}% complete</strong>
        </section>

        {resumeMessage && (
          <p className="booking-payment-notice" role="status">
            {resumeMessage}
          </p>
        )}

        {setupSubPhase === 'wizard' && (
          <div className="artisan-stepper" aria-label="Artisan setup steps">
            {ARTISAN_SETUP_STEPS.map((stepItem, index) => {
              const number = index + 1;
              return (
                <button
                  key={stepItem.id}
                  type="button"
                  className={number <= step ? 'active' : ''}
                  onClick={() => {
                    if (number < step) {
                      setStep(number);
                    }
                  }}
                  disabled={number > step}
                  aria-current={number === step ? 'step' : undefined}
                >
                  <span className="artisan-stepper-num">{number}</span>
                  <span className="artisan-stepper-label">{stepItem.label}</span>
                  <span className="artisan-stepper-label-short">{stepItem.shortLabel}</span>
                </button>
              );
            })}
          </div>
        )}

        {kycSubmission && setupSubPhase === 'wizard' && (
          <div
            className={`payment-note artisan-review-note ${kycSubmission.status === 'APPROVED' ? 'success' : ''}`}
          >
            <strong>KYC status: {kycSubmission.status.toLowerCase().replace(/_/g, ' ')}</strong>
            <span>Admin will review your profile before it appears publicly.</span>
          </div>
        )}

        {setupSubPhase === 'verification' ? (
          <ArtisanLandingStepVerify landing={landing} />
        ) : (
          <>
            {step === 1 && <ArtisanLandingStepBasic landing={landing} />}
            {step === 2 && <ArtisanLandingStepService landing={landing} />}
            {step === 3 && <ArtisanLandingStepGoLive landing={landing} />}
          </>
        )}

        <div className="artisan-setup-actions">
          {setupSubPhase === 'verification' ? (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={backToGoLiveFromVerification}
              >
                Back
              </button>
              <button type="button" className="secondary-button" onClick={saveAndExit}>
                Save & exit
              </button>
              <button
                disabled={
                  busy ||
                  !submitAgreed ||
                  setup.documentNumber.length !== 11 ||
                  !kycDocumentFile ||
                  !setup.address.trim()
                }
                onClick={() =>
                  runAction(submitKycVerification, 'Verification submitted — awaiting approval')
                }
              >
                {busy ? 'Submitting verification…' : 'Submit verification'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setStep((current) => Math.max(1, current - 1))}
                disabled={step === 1}
              >
                Previous
              </button>
              <button type="button" className="secondary-button" onClick={saveAndExit}>
                Save & exit
              </button>
              {step === 1 && (
                <button
                  disabled={busy || !agreed || !setup.fullName || !setup.categoryId || !setup.location || !setup.area}
                  onClick={() => runAction(saveBasicInfo, SAVED_NOTICE)}
                >
                  Next
                </button>
              )}
              {step === 2 && (
                <button
                  disabled={busy || !servicePackage?.title.trim() || !servicePackage?.priceFrom.trim()}
                  onClick={() => runAction(saveOffering, SAVED_NOTICE)}
                >
                  Next
                </button>
              )}
              {step === 3 && (
                <button
                  disabled={busy || uploadingPortfolio || selectedDays.length === 0}
                  onClick={() => runAction(saveAvailabilityAndContinue, SAVED_NOTICE)}
                >
                  Continue to verification
                </button>
              )}
            </>
          )}
        </div>
      </main>
    </ArtisanSetupShell>
  );
}
