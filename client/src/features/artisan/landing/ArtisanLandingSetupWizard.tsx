import { ArtisanOnboardingMediaStep } from '../../../views/ArtisanOnboardingMediaStep';
import { ArtisanSetupShell } from '../../../views/ArtisanSetupShell';
import { ARTISAN_SETUP_STEPS } from './artisanLandingTypes';
import type { ArtisanLandingModel } from './artisanLandingTypes';
import { ArtisanLandingStepBasic } from './ArtisanLandingStepBasic';
import { ArtisanLandingStepPricing } from './ArtisanLandingStepPricing';
import { ArtisanLandingStepSubmit } from './ArtisanLandingStepSubmit';

export function ArtisanLandingSetupWizard({ landing }: { landing: ArtisanLandingModel }) {
  const {
    displayName,
    accountEmail,
    step,
    setStep,
    busy,
    runAction,
    kycSubmission,
    setup,
    agreed,
    servicePackages,
    portfolioImages,
    uploadingPortfolio,
    uploadPortfolioFile,
    uploadPortfolioFiles,
    removePortfolioImage,
    submitAgreed,
    kycDocumentFile,
    selectedDays,
    saveBasicInfo,
    saveOffering,
    submitForVerification,
  } = landing;

  return (
    <ArtisanSetupShell displayName={displayName} email={accountEmail}>
      <main className="artisan-setup-page">
        <section className="artisan-setup-head">
          <div>
            <h1>Set up your artisan profile</h1>
            <p className="muted">
              Follow the steps below. Your profile goes live only after KYC and admin approval.
            </p>
          </div>
          <strong>Step {step} of 4</strong>
        </section>

        <div className="artisan-stepper" aria-label="Artisan setup steps">
          {ARTISAN_SETUP_STEPS.map((stepItem, index) => {
            const number = index + 1;
            return (
              <button
                key={stepItem.id}
                type="button"
                className={number <= step ? 'active' : ''}
                onClick={() => setStep(number)}
                aria-current={number === step ? 'step' : undefined}
              >
                <span className="artisan-stepper-num">{number}</span>
                <span className="artisan-stepper-label">{stepItem.label}</span>
                <span className="artisan-stepper-label-short">{stepItem.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {kycSubmission && (
          <div
            className={`payment-note artisan-review-note ${kycSubmission.status === 'APPROVED' ? 'success' : ''}`}
          >
            <strong>KYC status: {kycSubmission.status.toLowerCase().replace(/_/g, ' ')}</strong>
            <span>{kycSubmission.reviewNote || 'Admin will review your profile before it appears publicly.'}</span>
          </div>
        )}

        {step === 1 && <ArtisanLandingStepBasic landing={landing} />}
        {step === 2 && <ArtisanLandingStepPricing landing={landing} />}
        {step === 3 && (
          <ArtisanOnboardingMediaStep
            portfolioImages={portfolioImages}
            busy={busy}
            uploadingPortfolio={uploadingPortfolio}
            runAction={runAction}
            uploadPortfolioFile={uploadPortfolioFile}
            uploadPortfolioFiles={uploadPortfolioFiles}
            removePortfolioImage={removePortfolioImage}
          />
        )}
        {step === 4 && <ArtisanLandingStepSubmit landing={landing} />}

        <div className="artisan-setup-actions">
          <button type="button" className="secondary-button" onClick={() => setStep((current) => Math.max(1, current - 1))}>
            {step === 1 ? 'Back' : 'Previous'}
          </button>
          {step === 1 && (
            <button
              disabled={busy || !agreed || !setup.fullName || !setup.categoryId || !setup.location}
              onClick={() => runAction(saveBasicInfo, 'Basic profile saved')}
            >
              Next
            </button>
          )}
          {step === 2 && (
            <button
              disabled={
                busy ||
                !servicePackages.some(
                  (servicePackage) => servicePackage.title.trim() && servicePackage.priceFrom.trim()
                )
              }
              onClick={() =>
                runAction(
                  saveOffering,
                  servicePackages.length > 1 ? 'Service packages saved' : 'Service package saved'
                )
              }
            >
              Next
            </button>
          )}
          {step === 3 && (
            <button disabled={busy || uploadingPortfolio} onClick={() => setStep(4)}>
              {portfolioImages.length > 0 ? 'Next' : 'Skip for now'}
            </button>
          )}
          {step === 4 && (
            <button
              disabled={
                busy ||
                !submitAgreed ||
                setup.documentNumber.length !== 11 ||
                !kycDocumentFile ||
                selectedDays.length === 0
              }
              onClick={() => runAction(submitForVerification, 'Application submitted — awaiting approval')}
            >
              Submit for verification
            </button>
          )}
        </div>
      </main>
    </ArtisanSetupShell>
  );
}
