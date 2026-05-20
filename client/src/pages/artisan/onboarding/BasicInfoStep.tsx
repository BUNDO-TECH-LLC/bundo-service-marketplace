import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import { AppIcon } from '../../../components/ui/AppIcon';
import { api } from '../../../lib/api';
import { auth } from '../../../lib/firebase';
import { resolveApiSession } from '../../../lib/authSession';
import {
  parseArtisanLocation,
  requestDeviceCoordinates,
} from '../../../lib/artisanLocation';
import { readOnboardingCategoryId, writeOnboardingCategoryId } from '../../../lib/artisanOnboarding';
import {
  fieldErrorClassName,
  formErrorClassName,
  inputClassName,
  labelClassName,
  requiredLabelClassName,
  requiredMarkClassName,
} from '../../../lib/formStyles';
import { appRoutes } from '../../../routes/paths';
import type { Artisan, Category } from '../../../types';
import { OnboardingNavFooter } from './OnboardingNavFooter';
import { isDevOnboardingPreview, onboardingStepPath } from './onboardingPreview';

export function BasicInfoStep() {
  const navigate = useNavigate();
  const location = useLocation();
  const devPreview = isDevOnboardingPreview(location.pathname);
  const [token, setToken] = useState('');
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locationText, setLocationText] = useState('');
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [coordsNotice, setCoordsNotice] = useState('');
  const [coordsError, setCoordsError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const savedCategoryId = readOnboardingCategoryId();

    if (savedCategoryId) {
      setCategoryId(savedCategoryId);
    }
  }, []);

  useEffect(() => {
    if (devPreview) {
      setFullName((current) => current || 'Ada Okonkwo');
      setLocationText((current) => current || 'Lekki, Lagos');

      void api<{ categories: Category[] }>('/categories')
        .then((response) => {
          setCategories(response.categories ?? []);
        })
        .catch(() => {
          setFormError('Could not load categories. Start the API server to preview the dropdown.');
        });

      return undefined;
    }

    if (!auth) {
      return undefined;
    }

    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        return;
      }

      setFullName(user.displayName || '');

      try {
        const session = await resolveApiSession(user);
        setToken(session.token);

        const [profileResponse, categoriesResponse] = await Promise.all([
          api<{ profile: Artisan | null }>('/artisans/me', { token: session.token }).catch(() => ({
            profile: null,
          })),
          api<{ categories: Category[] }>('/categories'),
        ]);

        if (profileResponse.profile) {
          const existing = profileResponse.profile;
          setProfile(existing);
          setBusinessName(existing.displayName || '');
          setLocationText(
            [existing.area, existing.city].filter(Boolean).join(', ')
          );
        }

        setCategories(categoriesResponse.categories ?? []);
      } catch {
        setFormError('Could not load your profile. Try again.');
      }
    });
  }, [devPreview]);

  async function useCurrentLocation() {
    setCoordsError('');
    setCoordsNotice('');
    setLocating(true);

    try {
      const coords = await requestDeviceCoordinates();
      setDeviceCoords(coords);
      setCoordsNotice('Coordinates saved. Enter your city or area above.');
    } catch (error) {
      setCoordsError(error instanceof Error ? error.message : 'Could not access your location.');
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setLocationError('');

    if (!termsAccepted) {
      setFormError('Accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    if (!categoryId) {
      setFormError('Select a service category.');
      return;
    }

    const trimmedName = fullName.trim();

    if (!trimmedName) {
      setFormError('Enter your full name.');
      return;
    }

    const parsedLocation = parseArtisanLocation(locationText, deviceCoords);

    if (!parsedLocation.ok) {
      setLocationError(parsedLocation.message);
      return;
    }

    const nextPath = onboardingStepPath('pricing', devPreview);

    if (devPreview && (!token || !auth?.currentUser)) {
      writeOnboardingCategoryId(categoryId);
      navigate(nextPath);
      return;
    }

    if (!token || !auth?.currentUser) {
      setFormError('Sign in again to continue.');
      return;
    }

    setSubmitting(true);

    try {
      if (auth.currentUser.displayName !== trimmedName) {
        await updateProfile(auth.currentUser, { displayName: trimmedName });
      }

      const displayName = businessName.trim() || trimmedName;

      await api('/artisans/profile', {
        method: profile ? 'PATCH' : 'POST',
        token,
        body: JSON.stringify({
          displayName,
          city: parsedLocation.value.city,
          area: parsedLocation.value.area,
          lat: parsedLocation.value.lat,
          lng: parsedLocation.value.lng,
        }),
      });

      writeOnboardingCategoryId(categoryId);
      navigate(nextPath);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setSubmitting(false);
    }
  }

  const nextDisabled = submitting || !termsAccepted;

  return (
    <>
      <section className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-8">
        <div className="grid gap-1">
          <h2 className="m-0 text-xl font-semibold text-[var(--color-ink)]">Basic Information</h2>
          <p className="m-0 text-sm text-[var(--color-text-muted)]">
            Tell us a bit about yourself so customers can find and trust you.
          </p>
        </div>

        <form className="mt-6 grid gap-5" id="basic-info-form" onSubmit={handleSubmit}>
          <label className={labelClassName}>
            <span className={requiredLabelClassName}>
              Full Name<em className={requiredMarkClassName}>*</em>
            </span>
            <input
              className={inputClassName}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Enter your name"
              autoComplete="name"
              required
            />
            <small className="text-sm text-[var(--color-text-muted)]">
              As in any legal documentation
            </small>
          </label>

          <label className={labelClassName}>
            <span>
              Business Name<em className={requiredMarkClassName}>*</em>
              <span className="font-normal text-[var(--color-text-muted)]"> (Optional)</span>
            </span>
            <input
              className={inputClassName}
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder="e.g Plumber, Hair stylist...etc"
            />
            <small className="text-sm text-[var(--color-text-muted)]">
              Leave blank to use your full name
            </small>
          </label>

          <label className={labelClassName}>
            <span className={requiredLabelClassName}>
              Service Category<em className={requiredMarkClassName}>*</em>
              <span className="font-normal text-[var(--color-text-muted)]"> (Required)</span>
            </span>
            <div className="relative">
              <select
                className={`${inputClassName} appearance-none pr-10`}
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <AppIcon
                icon="mdi:chevron-down"
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[var(--color-text-muted)]"
                size={20}
              />
            </div>
            <small className="text-sm text-[var(--color-text-muted)]">
              E.g Plumbing, Carpentry, Make-up Artist
            </small>
          </label>

          <div className="grid gap-[7px]">
            <label className={labelClassName} htmlFor="artisan-location">
              <span className={requiredLabelClassName}>
                Location<em className={requiredMarkClassName}>*</em>
                <span className="font-normal text-[var(--color-text-muted)]"> (Required)</span>
              </span>
            </label>
            <div className="relative">
              <input
                id="artisan-location"
                className={`${inputClassName} pr-10`}
                value={locationText}
                onChange={(event) => {
                  setLocationText(event.target.value);
                  setLocationError('');
                }}
                placeholder="Search for your city or area"
                required
              />
              <AppIcon
                icon="mdi:map-marker-outline"
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[var(--color-text-muted)]"
                size={20}
              />
            </div>
            <button
              type="button"
              className="inline-flex w-max items-center gap-1.5 bg-transparent p-0 text-sm font-bold text-[var(--color-accent-bright)] hover:text-[var(--color-accent-dark)]"
              onClick={useCurrentLocation}
              disabled={locating}
            >
              <AppIcon icon="mdi:crosshairs-gps" size={16} />
              {locating ? 'Getting location…' : 'Use your current location'}
            </button>
            {coordsNotice ? (
              <p className="m-0 text-sm text-[var(--color-text-muted)]">{coordsNotice}</p>
            ) : null}
            {coordsError ? <p className={fieldErrorClassName}>{coordsError}</p> : null}
            {locationError ? <p className={fieldErrorClassName}>{locationError}</p> : null}
          </div>

          <label className="flex items-start gap-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
            <input
              className="mt-1 h-4 w-4 accent-[var(--color-accent-bright)]"
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
            />
            <span>
              By continuing, you agree to our{' '}
              <Link className="font-bold text-[var(--color-accent-bright)]" to={appRoutes.help}>
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link className="font-bold text-[var(--color-accent-bright)]" to={appRoutes.help}>
                Privacy Policy
              </Link>
              . Your information will only be used to connect you with customers.
            </span>
          </label>

          {formError ? <p className={formErrorClassName}>{formError}</p> : null}
        </form>
      </section>

      <OnboardingNavFooter
        backTo={appRoutes.home}
        nextLabel={submitting ? 'Saving…' : 'Next'}
        nextDisabled={nextDisabled}
        nextType="submit"
        nextForm="basic-info-form"
      />
    </>
  );
}
