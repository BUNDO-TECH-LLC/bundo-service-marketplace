import type { PortfolioImage } from '../types';

export function AdminPortfolioGallery({
  images,
  artisanName,
}: {
  images: PortfolioImage[];
  artisanName?: string;
}) {
  if (!images.length) {
    return (
      <div className="admin-portfolio-empty">
        <p className="muted">No portfolio photos uploaded yet.</p>
      </div>
    );
  }

  return (
    <div
      className="admin-portfolio-gallery"
      aria-label={artisanName ? `Portfolio photos for ${artisanName}` : 'Portfolio photos'}
    >
      {images.map((image, index) => (
        <a
          key={image.id}
          className="admin-portfolio-thumb"
          href={image.url}
          target="_blank"
          rel="noreferrer"
        >
          <img src={image.url} alt={artisanName ? `${artisanName} photo ${index + 1}` : `Portfolio ${index + 1}`} />
        </a>
      ))}
    </div>
  );
}
