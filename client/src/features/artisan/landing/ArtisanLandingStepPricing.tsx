import type { ArtisanLandingModel } from './artisanLandingTypes';

export function ArtisanLandingStepPricing({ landing }: { landing: ArtisanLandingModel }) {
  const {
    setup,
    servicePackages,
    categories,
    updateServicePackage,
    addServicePackage,
    removeServicePackage,
  } = landing;

  return (
    <section className="artisan-setup-card wide">
      <h2>Set your pricing</h2>
      <p>Give customers a clear idea of what to expect before they book. You can update this any time.</p>
      <div className="setup-package-stack">
        {servicePackages.map((servicePackage, index) => (
          <article className="setup-package-card" key={servicePackage.localId}>
            <div className="setup-package-head">
              <h3>Package {index + 1}</h3>
              {servicePackages.length > 1 && (
                <button type="button" onClick={() => removeServicePackage(servicePackage.localId)}>
                  Remove
                </button>
              )}
            </div>
            <label>
              Primary Service
              <select
                value={servicePackage.categoryId || setup.categoryId}
                onChange={(event) =>
                  updateServicePackage(servicePackage.localId, 'categoryId', event.target.value)
                }
                required
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="setup-two-col">
              <label>
                Service name
                <input
                  value={servicePackage.title}
                  onChange={(event) => updateServicePackage(servicePackage.localId, 'title', event.target.value)}
                  placeholder="Basic inspection"
                  required
                />
              </label>
              <label>
                Price(₦)
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
            </div>
            <label>
              Description
              <textarea
                value={servicePackage.description}
                onChange={(event) =>
                  updateServicePackage(servicePackage.localId, 'description', event.target.value)
                }
                placeholder="Diagnosis and minor fixes"
              />
            </label>
          </article>
        ))}
      </div>
      <p className="orange-note">
        Packages help customers understand your offering upfront. You can still negotiate pricing directly
        with customers after a booking request is made.
      </p>
      <button type="button" className="full-orange" onClick={addServicePackage}>
        ＋ Add another Package
      </button>
    </section>
  );
}
