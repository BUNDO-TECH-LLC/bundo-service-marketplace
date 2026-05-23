import type { PortfolioImage } from '../types';

export function ProfilePortfolioGallery({
  images,
  artisanName,
}: {
  images: PortfolioImage[];
  artisanName: string;
}) {
  if (images.length === 0) {
    return (
      <div className="profile-portfolio-empty">
        <p className="muted">No portfolio photos yet.</p>
      </div>
    );
  }

  return (
    <div className="profile-portfolio-gallery">
      <div className="profile-portfolio-carousel" tabIndex={0} aria-label={`${artisanName} portfolio photos`}>
        {images.map((image, index) => (
          <figure className="profile-portfolio-slide" key={image.id}>
            <img
              src={image.url}
              alt={`${artisanName} work sample ${index + 1}`}
              loading={index < 5 ? 'eager' : 'lazy'}
              decoding="async"
            />
          </figure>
        ))}
      </div>
      {images.length > 4 && <p className="profile-portfolio-hint">Swipe to see more photos</p>}
    </div>
  );
}
