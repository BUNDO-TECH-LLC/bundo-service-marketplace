import { LegalLinks } from '../../../components/LegalLinks';
import type { ArtisanLandingModel } from './artisanLandingTypes';

export function ArtisanLandingStepBasic({ landing }: { landing: ArtisanLandingModel }) {
  const { setup, updateSetup, agreed, setAgreed, categories } = landing;

  return (
    <section className="artisan-setup-card">
      <h2>Basic Information</h2>
      <p>Tell us a bit about yourself so customers can find and trust you.</p>
      <label>
        Full Name<span>*</span>
        <input
          value={setup.fullName}
          onChange={(event) => updateSetup('fullName', event.target.value)}
          placeholder="Enter your name"
          required
        />
      </label>
      <small>As in any legal documentation</small>
      <label>
        Business Name<span>(Optional)</span>
        <input
          value={setup.businessName}
          onChange={(event) => updateSetup('businessName', event.target.value)}
          placeholder="e.g Plumber, Hair stylist...etc"
        />
      </label>
      <small>Leave blank to use your full name</small>
      <label>
        Service Category<span>(Required)</span>
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
      <small>E.g Plumbing, Carpentry, Make-up Artist</small>
      <label>
        Location<span>(Required)</span>
        <input
          value={setup.location}
          onChange={(event) => updateSetup('location', event.target.value)}
          placeholder="Search for your city or area"
          required
        />
      </label>
      <button className="location-link" type="button">
        ⌖ Use your current location
      </button>
      <label className="terms-row">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />{' '}
        <span>
          By continuing, you agree to our <LegalLinks />.
        </span>
      </label>
    </section>
  );
}
