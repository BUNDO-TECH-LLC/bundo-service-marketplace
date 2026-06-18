import { servicePlaceholderForCategory } from '../../../lib/artisanOnboarding';
import type { ArtisanLandingModel } from './artisanLandingTypes';

export function ArtisanLandingStepService({ landing }: { landing: ArtisanLandingModel }) {
  const { setup, servicePackages, categories, updateServicePackage } = landing;
  const servicePackage = servicePackages[0];
  const categoryName = categories.find((category) => category.id === setup.categoryId)?.name;
  const placeholder = servicePlaceholderForCategory(categoryName);

  if (!servicePackage) {
    return null;
  }

  return (
    <section className="artisan-setup-card wide">
      <h2>Your main service</h2>
      <p>
        What do customers book you for most often? You can add more packages later from your workspace.
      </p>

      {categoryName && (
        <p className="booking-payment-notice" role="status">
          Category: <strong>{categoryName}</strong>
        </p>
      )}

      <label>
        Service name<span>*</span>
        <input
          value={servicePackage.title}
          onChange={(event) => updateServicePackage(servicePackage.localId, 'title', event.target.value)}
          placeholder={placeholder}
          required
        />
      </label>

      <label>
        Starting price (₦)<span>*</span>
        <input
          value={servicePackage.priceFrom}
          onChange={(event) =>
            updateServicePackage(servicePackage.localId, 'priceFrom', event.target.value)
          }
          placeholder="5,000"
          inputMode="numeric"
          required
        />
      </label>

      <label>
        Short description <span className="muted">(optional)</span>
        <textarea
          value={servicePackage.description}
          onChange={(event) =>
            updateServicePackage(servicePackage.localId, 'description', event.target.value)
          }
          placeholder="What is included in this service?"
        />
      </label>

      <p className="orange-note">
        This is a guide price. You can still agree a different amount with customers after they request a
        booking.
      </p>
    </section>
  );
}
