import type { ActionRunner } from '../appTypes';
import type { PortfolioImage } from '../types';

export function ArtisanOnboardingMediaStep({
  portfolioImages,
  busy,
  uploadingPortfolio,
  runAction,
  uploadPortfolioFile,
  uploadPortfolioFiles,
  removePortfolioImage,
}: {
  portfolioImages: PortfolioImage[];
  busy: boolean;
  uploadingPortfolio: boolean;
  runAction: ActionRunner;
  uploadPortfolioFile: (file: File, displayOrder: number) => Promise<void>;
  uploadPortfolioFiles: (files: File[]) => Promise<void>;
  removePortfolioImage: (imageId: string) => Promise<void>;
}) {
  const remaining = Math.max(0, 12 - portfolioImages.length);

  return (
    <section className="artisan-setup-card media-step">
      <div className="media-step-intro">
        <h2>Add your photos</h2>
        <p>A clear profile photo and real work samples help customers trust you faster.</p>
        <p className="media-step-count" aria-live="polite">
          <strong>{portfolioImages.length}</strong> of 12 photos added
        </p>
      </div>

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
          <div className="media-profile-preview">
            <img src={portfolioImages[0].url} alt="Your profile photo" />
            <label className="media-upload-dropzone media-upload-dropzone--compact">
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
        ) : (
          <label className="media-upload-dropzone media-upload-dropzone--profile">
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
        )}
      </div>

      <div className="media-portfolio-block">
        <div className="media-portfolio-head">
          <h3>Work photos</h3>
          <p className="muted">Show finished jobs, before/after shots, or your workspace.</p>
        </div>

        <div className="setup-portfolio-grid">
          {portfolioImages.map((image, index) => (
            <div className="portfolio-image-card" key={image.id}>
              <img src={image.url} alt={`Work photo ${index + 1}`} />
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
          ))}

          {remaining > 0 && (
            <label className="portfolio-upload-tile">
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

      <p className="media-step-tip muted">Tip: artisans with 6+ photos tend to get more booking requests.</p>
    </section>
  );
}
