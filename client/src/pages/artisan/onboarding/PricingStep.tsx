import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { AppIcon } from '../../../components/ui/AppIcon';
import { api } from '../../../lib/api';
import { auth } from '../../../lib/firebase';
import { resolveApiSession } from '../../../lib/authSession';
import { readOnboardingCategoryId } from '../../../lib/artisanOnboarding';
import { parseNairaAmount } from '../../../lib/parseNairaAmount';
import {
  formErrorClassName,
  inputClassName,
  labelClassName,
} from '../../../lib/formStyles';
import type { Category, Offering } from '../../../types';
import { OnboardingNavFooter } from './OnboardingNavFooter';
import { isDevOnboardingPreview, onboardingStepPath } from './onboardingPreview';
import { STARTING_PRICE_OFFERING_TITLE } from './pricingConstants';

type ServicePackage = {
  clientId: string;
  offeringId?: string;
  categoryId: string;
  title: string;
  price: string;
  description: string;
};

function createPackage(defaultCategoryId = ''): ServicePackage {
  return {
    clientId: crypto.randomUUID(),
    categoryId: defaultCategoryId,
    title: '',
    price: '',
    description: '',
  };
}

function formatPriceInput(value: string) {
  const digits = value.replace(/[^\d]/g, '');

  if (!digits) {
    return '';
  }

  return Number(digits).toLocaleString('en-NG');
}

type PackageEditorProps = {
  index: number;
  pkg: ServicePackage;
  categories: Category[];
  canRemove: boolean;
  onChange: (next: ServicePackage) => void;
  onRemove: () => void;
};

function PackageEditor({
  index,
  pkg,
  categories,
  canRemove,
  onChange,
  onRemove,
}: PackageEditorProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-page)] p-4 sm:p-5">
      <PackageHeader index={index} canRemove={canRemove} onRemove={onRemove} />

      <div className="mt-4 grid gap-4">
        <label className={labelClassName}>
          <span>Primary Service</span>
          <div className="relative">
            <select
              className={`${inputClassName} appearance-none pr-10`}
              value={pkg.categoryId}
              onChange={(event) => onChange({ ...pkg, categoryId: event.target.value })}
              required
            >
              <option value="">Select your main craft</option>
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
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClassName}>
            <span>Additional Services</span>
            <input
              className={inputClassName}
              value={pkg.title}
              onChange={(event) => onChange({ ...pkg, title: event.target.value })}
              placeholder="Basic Inspection"
              required
            />
          </label>

          <label className={labelClassName}>
            <span>Price(₦)</span>
            <input
              className={inputClassName}
              value={pkg.price}
              onChange={(event) =>
                onChange({ ...pkg, price: formatPriceInput(event.target.value) })
              }
              placeholder="5,000"
              inputMode="numeric"
              required
            />
          </label>
        </div>

        <label className={labelClassName}>
          <span>Description</span>
          <textarea
            className={`${inputClassName} min-h-[100px] resize-y py-3`}
            value={pkg.description}
            onChange={(event) => onChange({ ...pkg, description: event.target.value })}
            placeholder="Diagnosis and minor fixes"
            rows={3}
          />
        </label>
      </div>
    </div>
  );
}

function PackageHeader({
  index,
  canRemove,
  onRemove,
}: {
  index: number;
  canRemove: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="m-0 text-base font-semibold text-[var(--color-ink)]">Package</h3>
      {canRemove ? (
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-full border-0 bg-[var(--color-danger-wash)] text-[var(--color-danger-dark)] hover:opacity-90"
          onClick={onRemove}
          aria-label={`Remove package ${index + 1}`}
        >
          <AppIcon icon="mdi:minus" size={18} />
        </button>
      ) : null}
    </div>
  );
}

export function PricingStep() {
  const navigate = useNavigate();
  const location = useLocation();
  const devPreview = isDevOnboardingPreview(location.pathname);
  const defaultCategoryId = readOnboardingCategoryId();

  const [token, setToken] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [startingPrice, setStartingPrice] = useState('');
  const [startingOfferingId, setStartingOfferingId] = useState<string | undefined>();
  const [packages, setPackages] = useState<ServicePackage[]>([createPackage(defaultCategoryId)]);
  const [removedOfferingIds, setRemovedOfferingIds] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const portfolioPath = onboardingStepPath('portfolio', devPreview);

  useEffect(() => {
    if (devPreview) {
      setStartingPrice((current) => current || '5,000');
      setPackages((current) =>
        current[0]?.title
          ? current
          : [
              {
                ...createPackage(defaultCategoryId),
                title: 'Basic Inspection',
                price: '8,000',
                description: 'Diagnosis and minor fixes',
              },
            ]
      );

      void api<{ categories: Category[] }>('/categories')
        .then((response) => setCategories(response.categories ?? []))
        .catch(() => {
          setFormError('Could not load categories. Start the API server to preview this step.');
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

      try {
        const session = await resolveApiSession(user);
        setToken(session.token);

        const [categoriesResponse, offeringsResponse] = await Promise.all([
          api<{ categories: Category[] }>('/categories'),
          api<{ offerings: Offering[] }>('/offerings/me', { token: session.token }).catch(() => ({
            offerings: [],
          })),
        ]);

        setCategories(categoriesResponse.categories ?? []);

        const offerings = offeringsResponse.offerings ?? [];
        const starting = offerings.find(
          (offering) => offering.title === STARTING_PRICE_OFFERING_TITLE
        );
        const packageOfferings = offerings.filter(
          (offering) => offering.title !== STARTING_PRICE_OFFERING_TITLE
        );

        if (starting) {
          setStartingOfferingId(starting.id);
          setStartingPrice(starting.priceFrom.toLocaleString('en-NG'));
        }

        if (packageOfferings.length > 0) {
          setPackages(
            packageOfferings.map((offering) => ({
              clientId: offering.id,
              offeringId: offering.id,
              categoryId: offering.categoryId,
              title: offering.title,
              price: offering.priceFrom.toLocaleString('en-NG'),
              description: offering.description || '',
            }))
          );
        } else if (defaultCategoryId) {
          setPackages([createPackage(defaultCategoryId)]);
        }
      } catch {
        setFormError('Could not load your services. Try again.');
      }
    });
  }, [defaultCategoryId, devPreview]);

  function updatePackage(clientId: string, next: ServicePackage) {
    setPackages((current) =>
      current.map((pkg) => (pkg.clientId === clientId ? next : pkg))
    );
  }

  function removePackage(clientId: string) {
    setPackages((current) => {
      const target = current.find((pkg) => pkg.clientId === clientId);

      if (target?.offeringId) {
        setRemovedOfferingIds((ids) => [...ids, target.offeringId!]);
      }

      return current.filter((pkg) => pkg.clientId !== clientId);
    });
  }

  function addPackage() {
    setPackages((current) => [...current, createPackage(defaultCategoryId)]);
  }

  function validateForm() {
    const startingAmount = parseNairaAmount(startingPrice);

    if (startingAmount == null || startingAmount <= 0) {
      return 'Enter a valid starting price.';
    }

    const validPackages = packages.filter(
      (pkg) => pkg.categoryId && pkg.title.trim() && parseNairaAmount(pkg.price) != null
    );

    if (validPackages.length === 0) {
      return 'Add at least one package with service name and price.';
    }

    for (const pkg of packages) {
      if (!pkg.categoryId || !pkg.title.trim()) {
        return 'Complete each package or remove it.';
      }

      const amount = parseNairaAmount(pkg.price);

      if (amount == null || amount <= 0) {
        return 'Enter a valid price for each package.';
      }
    }

    const packageAmounts = packages
      .map((pkg) => parseNairaAmount(pkg.price))
      .filter((amount): amount is number => amount != null);

    if (packageAmounts.length > 0 && startingAmount > Math.min(...packageAmounts)) {
      return 'Starting price should not be higher than your lowest package price.';
    }

    return null;
  }

  async function persistOfferings() {
    const startingAmount = parseNairaAmount(startingPrice)!;
    const categoryId = defaultCategoryId || packages[0]?.categoryId;

    if (!categoryId) {
      throw new Error('Select a category on the basic info step first.');
    }

    for (const offeringId of removedOfferingIds) {
      await api(`/offerings/${offeringId}`, { method: 'DELETE', token });
    }

    const startingBody = {
      categoryId,
      title: STARTING_PRICE_OFFERING_TITLE,
      description: 'Minimum amount charged for any job.',
      priceFrom: startingAmount,
    };

    if (startingOfferingId) {
      await api(`/offerings/${startingOfferingId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(startingBody),
      });
    } else {
      await api('/offerings', {
        method: 'POST',
        token,
        body: JSON.stringify(startingBody),
      });
    }

    for (const pkg of packages) {
      const body = {
        categoryId: pkg.categoryId,
        title: pkg.title.trim(),
        description: pkg.description.trim() || undefined,
        priceFrom: parseNairaAmount(pkg.price)!,
      };

      if (pkg.offeringId) {
        await api(`/offerings/${pkg.offeringId}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(body),
        });
      } else {
        await api('/offerings', {
          method: 'POST',
          token,
          body: JSON.stringify(body),
        });
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (devPreview && !token) {
      navigate(portfolioPath);
      return;
    }

    if (!token) {
      setFormError('Sign in again to continue.');
      return;
    }

    setSubmitting(true);

    try {
      await persistOfferings();
      navigate(portfolioPath);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save your pricing.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSkip() {
    navigate(portfolioPath);
  }

  return (
    <>
      <section className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-8">
        <PricingHeader />

        <form className="mt-6 grid gap-6" id="pricing-form" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <label className={labelClassName}>
              <span className="text-base font-semibold text-[var(--color-ink)]">
                Starting price
              </span>
              <p className="m-0 text-sm font-normal text-[var(--color-text-muted)]">
                The minimum amount you charge for any job. Shown on your profile card.
              </p>
            </label>
            <div className="flex overflow-hidden rounded-lg border border-[var(--color-input-border)] bg-white focus-within:border-[var(--color-accent)] focus-within:ring-3 focus-within:ring-[var(--color-accent-soft)]">
              <input
                className="min-h-[43px] flex-1 border-0 bg-transparent px-3.5 py-2.5 text-[15px] text-[var(--color-ink)] outline-none"
                value={startingPrice}
                onChange={(event) =>
                  setStartingPrice(formatPriceInput(event.target.value))
                }
                placeholder="e.g. ₦5000"
                inputMode="numeric"
                required
              />
              <span className="flex min-h-[43px] items-center border-l border-[var(--color-input-border)] bg-[var(--color-soft)] px-4 text-sm font-semibold text-[var(--color-text-muted)]">
                Per job
              </span>
            </div>
          </div>

          <div className="grid gap-3">
            <p className="m-0 text-sm text-[var(--color-text-muted)]">
              Add named packages so customers can choose exactly what they need.
            </p>

            {packages.map((pkg, index) => (
              <PackageEditor
                key={pkg.clientId}
                index={index}
                pkg={pkg}
                categories={categories}
                canRemove={packages.length > 1}
                onChange={(next) => updatePackage(pkg.clientId, next)}
                onRemove={() => removePackage(pkg.clientId)}
              />
            ))}
          </div>

          <p className="m-0 text-sm leading-relaxed text-[var(--color-accent-bright)]">
            Packages help customers understand your offering upfront. You can still negotiate
            pricing directly with customers after a booking request is made.
          </p>

          <button
            type="button"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent-bright)] px-4 text-base font-bold text-white hover:bg-[var(--color-primary-hover)]"
            onClick={addPackage}
          >
            <AppIcon icon="mdi:plus" size={20} />
            Add another Package
          </button>

          {formError ? <p className={formErrorClassName}>{formError}</p> : null}
        </form>
      </section>

      <OnboardingNavFooter
        skipTo={devPreview ? portfolioPath : undefined}
        onSkip={devPreview ? undefined : handleSkip}
        skipLabel="Skip"
        nextLabel={submitting ? 'Saving…' : 'Next'}
        nextDisabled={submitting}
        nextType="submit"
        nextForm="pricing-form"
      />
    </>
  );
}

function PricingHeader() {
  return (
    <div className="grid gap-1">
      <h2 className="m-0 text-xl font-semibold text-[var(--color-ink)]">Set your pricing</h2>
      <p className="m-0 text-sm text-[var(--color-text-muted)]">
        Give customers a clear idea of what to expect before they book. You can update this any
        time.
      </p>
    </div>
  );
}
