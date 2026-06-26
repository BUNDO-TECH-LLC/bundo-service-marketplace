import { ArtisanLocationField } from '../../../components/ArtisanLocationField';
import type { ArtisanLandingModel } from './artisanLandingTypes';

export function ArtisanLandingStepBasic({ landing }: { landing: ArtisanLandingModel }) {
  const {
    setup,
    applyCatalogLocation,
    agreed,
    setAgreed,
    categories,
    useCurrentLocation,
    busy,
    accountEmail,
    updateSetup,
  } = landing;

  return (
    <section className="artisan-setup-card">
      <h2>About you</h2>
      <p>Tell customers who you are and where you work. We pre-filled what we already know.</p>

      {accountEmail && (
        <label>
          Email
          <input type="email" value={accountEmail} readOnly disabled />
        </label>
      )}

      <label>
        Full name<span>*</span>
        <input
          value={setup.fullName}
          onChange={(event) => updateSetup('fullName', event.target.value)}
          placeholder="Enter your name"
          required
        />
      </label>
      <small className="muted">First name and surname exactly as they appear on your NIN.</small>

      <label>
        Primary service category<span>*</span>
        <select
          value={setup.categoryId}
          onChange={(event) => updateSetup('categoryId', event.target.value)}
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

      <label>
        Where you work<span>*</span>
        <ArtisanLocationField
          locationLabel={setup.locationLabel}
          disabled={busy}
          onSelect={applyCatalogLocation}
          onUseMyLocation={() => {
            void useCurrentLocation();
          }}
        />
      </label>
      <small className="muted">Pick your state and area so customers can find you in search.</small>

      <label className="terms-row">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />{' '}
        <span>By continuing, you agree to our terms and privacy policy.</span>
      </label>
    </section>
  );
}
