import type { ActionRunner } from '../appTypes';
import type { PortfolioImage } from '../types';
import { optimizeCloudinaryUrl } from '../lib/cloudinaryUrl';

type ArtisanPortfolioManagerProps = {
  variant: 'onboarding' | 'settings' | 'pending';
  portfolioImages: PortfolioImage[];
  busy: boolean;
  uploadingPortfolio: boolean;
  runAction: ActionRunner;
  uploadPortfolioFile: (file: File, displayOrder: number) => Promise<void>;
  uploadPortfolioFiles: (files: File[]) => Promise<void>;
  removePortfolioImage: (imageId: string) => Promise<void>;
  reorderPortfolioImage?: (imageId: string, displayOrder: number) => Promise<void>;
};

export function ArtisanPortfolioManager({
  variant,
  portfolioImages,
  busy,
  uploadingPortfolio,
  runAction,
  uploadPortfolioFile,
  uploadPortfolioFiles,
  removePortfolioImage,
  reorderPortfolioImage,
}: ArtisanPortfolioManagerProps) {
  const remaining = Math.max(0, 12 - portfolioImages.length);
  const rootClass =
    variant === 'onboarding'
      ? 'artisan-setup-card media-step'
      : variant === 'pending'
        ? 'artisan-pending-portfolio'
        : 'artisan-settings-card artisan-portfolio-settings';

  return (
    <section className={rootClass}>
      {variant === 'settings' && (
        <>
          <h2>Photos</h2>
          <p>Your profile photo and work samples appear on your public Bundo profile. You can update them anytime.</p>
        </>
      )}
      {variant === 'pending' && (
        <>
          <h2>Add photos for review</h2>
          <p className="muted">
            Optional but recommended — help our team verify your work while your application is pending.
          </p>
        </>
      )}
      {variant === 'onboarding' && <OnboardingIntro portfolioCount={portfolioImages.length} />}

      {variant !== 'onboarding' && (
        <p className="media-step-count" aria-live="polite">
          <strong>{portfolioImages.length}</strong> of 12 photos added
        </p>
      )}

      {uploadingPortfolio && (
        <p className="media-upload-status" role="status">
          <span className="media-upload-spinner" aria-hidden="true" />
          Uploading your photos…
        </p>
      )}

      <div className="media-profile-block">
        <h3>Profile photo</h3>
        <p className="muted">This is the first image customers see on your card.</p>
        {portfolioImages[0] ? (
          <ProfilePhotoPreview
            url={portfolioImages[0].url}
            busy={busy}
            uploadingPortfolio={uploadingPortfolio}
            runAction={runAction}
            uploadPortfolioFile={uploadPortfolioFile}
          />
        ) : (
          <ProfilePhotoEmpty
            busy={busy}
            uploadingPortfolio={uploadingPortfolio}
            runAction={runAction}
            uploadPortfolioFile={uploadPortfolioFile}
          />
        )}
      </div>

      <div className="media-portfolio-block">
        <WorkPhotosHead />
        <div className="setup-portfolio-grid">
          {portfolioImages.map((image, index) => (
            <PortfolioImageCard
              key={image.id}
              image={image}
              index={index}
              busy={busy}
              uploadingPortfolio={uploadingPortfolio}
              runAction={runAction}
              removePortfolioImage={removePortfolioImage}
              reorderPortfolioImage={reorderPortfolioImage}
              imageCount={portfolioImages.length}
            />
          ))}

          {remaining > 0 && (
            <label className={`portfolio-upload-tile${uploadingPortfolio ? ' portfolio-upload-tile--busy' : ''}`}>
              <span className="media-upload-icon" aria-hidden="true" />
              <span className="portfolio-upload-label">Add photos</span>
              <span className="portfolio-upload-hint">
                {remaining === 1 ? '1 slot left' : `Up to ${remaining} more`}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={busy || uploadingPortfolio}
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  if (!files.length) return;
                  void runAction(
                    () => uploadPortfolioFiles(files),
                    files.length > 1 ? 'Photos uploaded' : 'Photo uploaded'
                  );
                  event.currentTarget.value = '';
                }}
              />
            </label>
          )}
        </div>
      </div>

      <p className="media-step-tip muted">
        {variant === 'onboarding'
          ? 'Optional — skip for now and add more anytime from Profile. Artisans with 6+ photos tend to get more bookings.'
          : variant === 'pending'
            ? 'Our team can review these photos while your application is pending.'
            : 'Tip: artisans with 6+ photos tend to get more booking requests.'}
      </p>
    </section>
  );
}

function OnboardingIntro({ portfolioCount }: { portfolioCount: number }) {
  return (
    <div className="media-step-intro">
      <p className="eyebrow optional-badge">Optional</p>
      <h2>Add photos</h2>
      <p>
        A profile photo and a few work samples help customers trust you. You can skip now and add more later from
        Profile.
      </p>
      <p className="media-step-count" aria-live="polite">
        <strong>{portfolioCount}</strong> of 12 photos added
      </p>
    </div>
  );
}

function WorkPhotosHead() {
  return (
    <div className="media-portfolio-head">
      <h3>Work photos</h3>
      <p className="muted">Show finished jobs, before/after shots, or your workspace.</p>
    </div>
  );
}

function ProfilePhotoPreview({
  url,
  busy,
  uploadingPortfolio,
  runAction,
  uploadPortfolioFile,
}: {
  url: string;
  busy: boolean;
  uploadingPortfolio: boolean;
  runAction: ActionRunner;
  uploadPortfolioFile: (file: File, displayOrder: number) => Promise<void>;
}) {
  return (
    <div className="media-profile-preview">
      <img src={url} alt="Your profile photo" />
      <label className={`media-upload-dropzone media-upload-dropzone--compact${uploadingPortfolio ? ' media-upload-dropzone--busy' : ''}`}>
        <span className="media-upload-icon" aria-hidden="true" />
        <span className="media-upload-title">Change photo</span>
        <span className="media-upload-hint">JPG or PNG · Max 5MB</span>
        <input
          type="file"
          accept="image/*"
          disabled={busy || uploadingPortfolio}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void runAction(() => uploadPortfolioFile(file, 0), 'Profile photo updated');
            event.currentTarget.value = '';
          }}
        />
      </label>
    </div>
  );
}

function ProfilePhotoEmpty({
  busy,
  uploadingPortfolio,
  runAction,
  uploadPortfolioFile,
}: {
  busy: boolean;
  uploadingPortfolio: boolean;
  runAction: ActionRunner;
  uploadPortfolioFile: (file: File, displayOrder: number) => Promise<void>;
}) {
  return (
      <label className={`media-upload-dropzone media-upload-dropzone--profile${uploadingPortfolio ? ' media-upload-dropzone--busy' : ''}`}>
      <span className="media-upload-icon" aria-hidden="true" />
      <span className="media-upload-title">Add profile photo</span>
      <span className="media-upload-hint">JPG or PNG · Max 5MB · Square works best</span>
      <input
        type="file"
        accept="image/*"
        disabled={busy || uploadingPortfolio}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void runAction(() => uploadPortfolioFile(file, 0), 'Profile photo uploaded');
          event.currentTarget.value = '';
        }}
      />
    </label>
  );
}

function PortfolioImageCard({
  image,
  index,
  busy,
  uploadingPortfolio,
  runAction,
  removePortfolioImage,
  reorderPortfolioImage,
  imageCount,
}: {
  image: PortfolioImage;
  index: number;
  busy: boolean;
  uploadingPortfolio: boolean;
  runAction: ActionRunner;
  removePortfolioImage: (imageId: string) => Promise<void>;
  reorderPortfolioImage?: (imageId: string, displayOrder: number) => Promise<void>;
  imageCount: number;
}) {
  return (
    <div className="portfolio-image-card">
      <img src={optimizeCloudinaryUrl(image.url, 480)} alt={`Work photo ${index + 1}`} />
      {reorderPortfolioImage && imageCount > 1 && (
        <div className="portfolio-image-order">
          <button
            type="button"
            className="secondary-button"
            disabled={busy || uploadingPortfolio || index === 0}
            aria-label={`Move photo ${index + 1} earlier`}
            onClick={() =>
              runAction(() => reorderPortfolioImage(image.id, index - 1), 'Photo order updated')
            }
          >
            ↑
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={busy || uploadingPortfolio || index >= imageCount - 1}
            aria-label={`Move photo ${index + 1} later`}
            onClick={() =>
              runAction(() => reorderPortfolioImage(image.id, index + 1), 'Photo order updated')
            }
          >
            ↓
          </button>
        </div>
      )}
      <button
        type="button"
        className="portfolio-image-remove"
        aria-label={`Remove work photo ${index + 1}`}
        disabled={busy || uploadingPortfolio}
        onClick={() => runAction(() => removePortfolioImage(image.id), 'Photo removed')}
      >
        ×
      </button>
    </div>
  );
}
