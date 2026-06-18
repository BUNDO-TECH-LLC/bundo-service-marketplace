import { nigeriaStates } from '../../../lib/geo';
import type { ArtisanLandingModel } from './artisanLandingTypes';

export function ArtisanLandingStepBasic({ landing }: { landing: ArtisanLandingModel }) {
  const { setup, updateSetup, agreed, setAgreed, categories, useCurrentLocation, busy, accountEmail } =
    landing;

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
        State<span>*</span>
        <select
          value={setup.location}
          onChange={(event) => updateSetup('location', event.target.value)}
          required
        >
          <option value="">Select your state</option>
          {nigeriaStates.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </label>

      <label>
        Area / city<span>*</span>
        <input
          value={setup.area}
          onChange={(event) => updateSetup('area', event.target.value)}
          placeholder="e.g. Lekki, Ikeja, GRA"
          required
        />
      </label>

      <button
        className="location-link"
        type="button"
        disabled={busy}
        onClick={() => {
          void useCurrentLocation();
        }}
      >
        ⌖ Use your current location
      </button>

      <label className="terms-row">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />{' '}
        <span>By continuing, you agree to our terms and privacy policy.</span>
      </label>
    </section>
  );
}
