import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { CustomerHeader } from '../../components/customer/CustomerHeader';
import { AppIcon } from '../../components/ui/AppIcon';
import { ProfileAvatar } from '../../components/ui/ProfileAvatar';
import {
  customerDashboardFallbackCategories,
  customerDashboardFallbackRecommendations,
  nigeriaStates,
} from '../../constants/data';
import { api } from '../../lib/api';
import { resolveApiSession } from '../../lib/authSession';
import { categoryIcon } from '../../lib/categoryIcon';
import { auth } from '../../lib/firebase';
import { artisanProfileImageUrl } from '../../lib/profileImage';
import { capitalizeLeadingCharacter } from '../../lib/userDisplayName';
import {
  appRoutes,
  buildBookJobPath,
  buildCategoriesPath,
  buildCustomerWorkspacePath,
} from '../../routes/paths';
import type { ApiUser, Category, Offering } from '../../types';

const heroImage =
  'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1300&q=80';

function money(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value);
}

function RatingStars() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[var(--color-accent-button)]" aria-label="5 star rating">
      {Array.from({ length: 5 }).map((_, index) => (
        <AppIcon key={index} icon="mdi:star" size={14} />
      ))}
    </span>
  );
}

type CustomerDashboardProps = {
  requireAuth?: boolean;
};

type LocationDropdownProps = {
  icon: string;
  iconClassName: string;
  textClassName: string;
  value: string;
  onChange: (value: string) => void;
};

function LocationDropdown({
  icon,
  iconClassName,
  textClassName,
  value,
  onChange,
}: LocationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const selectedLocationLabel = value ? `${value}, Nigeria` : 'Lagos, Nigeria';

  return (
    <div className="relative min-w-0 flex-1" ref={dropdownRef}>
      <button
        className="flex w-full min-w-0 items-center gap-2.5 bg-transparent p-0 text-left"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select location"
        onClick={() => setIsOpen((current) => !current)}
      >
        <AppIcon icon={icon} className={iconClassName} size={24} />
        <span className={`${textClassName} min-w-0 flex-1 truncate pl-1`}>
          {selectedLocationLabel}
        </span>
        <AppIcon
          icon="mdi:chevron-down"
          className={`text-[var(--color-ink)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          size={18}
        />
      </button>

      {isOpen ? (
        <div
          className="absolute top-[calc(100%+8px)] left-0 right-0 z-30 max-h-64 overflow-auto rounded-lg border border-[var(--color-input-border)] bg-[var(--color-paper)] p-1 shadow-[0_10px_28px_var(--shadow-light)]"
          role="listbox"
          aria-label="Location options"
        >
          <button
            className="w-full rounded-md px-3 py-2 text-left text-[var(--color-ink)] hover:bg-[var(--color-soft)]"
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
          >
            Lagos, Nigeria
          </button>
          {nigeriaStates
            .filter((state) => state !== 'Lagos')
            .map((state) => (
              <button
                key={state}
                className="w-full rounded-md px-3 py-2 text-left text-[var(--color-ink)] hover:bg-[var(--color-soft)]"
                type="button"
                onClick={() => {
                  onChange(state);
                  setIsOpen(false);
                }}
              >
                {state}, Nigeria
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}

export default function CustomerDashboard({ requireAuth = true }: CustomerDashboardProps) {
  const navigate = useNavigate();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [me, setMe] = useState<ApiUser | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('');

  useEffect(() => {
    if (!requireAuth) {
      setMe({
        firebaseUid: 'dev-customer',
        email: 'ella@example.com',
        phone: null,
        role: 'CUSTOMER',
        status: 'ACTIVE',
      });
      return undefined;
    }

    if (!auth) {
      navigate('/login', { replace: true });
      return undefined;
    }

    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }

      try {
        let session = await resolveApiSession(user);

        if (session.user.role === null) {
          await api('/users/role', {
            method: 'PATCH',
            token: session.token,
            body: JSON.stringify({ role: 'CUSTOMER' }),
          });
          const refreshed = await api<{ user: ApiUser }>('/me', { token: session.token });
          session = { token: session.token, user: refreshed.user };
        }

        if (session.user.role === 'ADMIN') {
          navigate(appRoutes.admin, { replace: true });
          return;
        }

        if (session.user.role === 'ARTISAN') {
          navigate(appRoutes.artisanDashboard, { replace: true });
          return;
        }

        setFirebaseUser(user);
        setMe(session.user);
      } catch {
        navigate('/login', { replace: true });
      }
    });
  }, [navigate, requireAuth]);

  useEffect(() => {
    Promise.all([
      api<{ categories: Category[] }>('/categories'),
      api<{ offerings: Offering[] }>('/offerings?page=1&limit=12&sort=rating'),
    ])
      .then(([categoryRes, offeringRes]) => {
        setCategories(categoryRes.categories);
        setOfferings(offeringRes.offerings);
      })
      .catch(() => undefined);
  }, []);

  const visibleCategories = useMemo(
    () => (categories.length > 0 ? categories.slice(0, 7) : customerDashboardFallbackCategories),
    [categories]
  );

  function openCategories(options?: { categoryId?: string }) {
    navigate(
      buildCategoriesPath({
        q: searchTerm.trim() || undefined,
        state: selectedState || undefined,
        categoryId: options?.categoryId,
      })
    );
  }

  function openWorkspace(section: 'bookings' | 'messages') {
    navigate(buildCustomerWorkspacePath(section));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openCategories();
  }

  async function logout() {
    if (auth) {
      await signOut(auth);
    }
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-full">
      <CustomerHeader
        firebaseUser={firebaseUser}
        me={me}
        activeNav="dashboard"
        searchContent={
          <form
            className="grid w-[min(100%,402px)] justify-self-end grid-cols-[minmax(170px,1fr)_minmax(150px,0.92fr)] items-center rounded-lg border border-[var(--color-input-border)] bg-[var(--color-paper)] max-[1180px]:w-full max-[1180px]:justify-self-stretch max-[720px]:grid-cols-1"
            onSubmit={submitSearch}
          >
            <label className="flex min-w-0 items-center gap-2.5 px-3 py-2.5 first:border-r first:border-[var(--color-line)] max-[720px]:first:border-r-0 max-[720px]:first:border-b">
              <AppIcon icon="mingcute:search-line" className="text-2xl leading-none text-[var(--color-ink)]" size={24} />
              <input
                className="min-w-0 border-0 bg-transparent p-0 font-medium text-[var(--color-ink)] outline-none"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search for artisan"
                type="search"
                aria-label="Search for artisan"
              />
            </label>

            <div className="flex min-w-0 items-center px-3 py-2.5 max-[720px]:border-b">
              <LocationDropdown
                icon="mingcute:location-line"
                iconClassName="text-2xl leading-none text-[var(--color-ink)]"
                textClassName="font-medium text-[var(--color-ink)]"
                value={selectedState}
                onChange={setSelectedState}
              />
            </div>
          </form>
        }
        onOpenDashboard={() => navigate(appRoutes.customerDashboard)}
        onOpenMarketplace={openCategories}
        onOpenNotifications={() => navigate(buildCustomerWorkspacePath('notifications'))}
        onOpenWorkspace={openWorkspace}
        onUserUpdated={setMe}
        onLogout={logout}
      />

      <main className=" flex flex-col gap-16 app-screen-gutter pb-24 max-[720px]:pt-8 max-[720px]:pb-16">
        <section className="grid min-h-[642px] grid-cols-[minmax(430px,1fr)_minmax(430px,0.94fr)] items-center gap-[clamp(42px,7vw,84px)] max-[1180px]:grid-cols-1 max-[720px]:min-h-0 max-[720px]:gap-7">
          <div className="max-w-[600px]">
            <h1 className="m-0 max-w-[560px] text-[50px] leading-[1.12] font-medium text-[var(--color-ink)] max-[720px]:text-[42px]">
              Connect with Artisans who <span className="text-[var(--color-accent-bright)]">deliver.</span>
            </h1>
            <form className="mt-6 w-[min(100%,596px)] rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-2 shadow-[0_4px_14px_var(--shadow-light)]" onSubmit={submitSearch}>
              <div className="grid grid-cols-[minmax(180px,1fr)_minmax(168px,0.86fr)_120px] max-[720px]:grid-cols-1">
                <label className="flex min-h-12 min-w-0 items-center gap-2.5 border-r border-[var(--color-line)] px-3.5 max-[720px]:border-r-0 max-[720px]:border-b">
                  <AppIcon icon="mingcute:search-line" className="text-2xl leading-none text-[var(--color-accent-bright)]" />
                  <input
                    className="min-w-0 border-0 bg-transparent p-0 text-base font-medium text-[var(--color-ink)] outline-none"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search for artisan..."
                    type="search"
                    aria-label="Search for artisan"
                  />
                </label>
                <div className="flex min-h-12 min-w-0 items-center border-r border-[var(--color-line)] px-3.5 max-[720px]:border-r-0 max-[720px]:border-b">
                  <LocationDropdown
                    icon="mingcute:location-line"
                    iconClassName="text-2xl leading-none text-[var(--color-accent-bright)]"
                    textClassName="text-base font-medium text-[var(--color-ink)]"
                    value={selectedState}
                    onChange={setSelectedState}
                  />
                </div>
                <button className="min-h-12 rounded-lg bg-[var(--color-primary)] p-3 text-base font-semibold text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)]" type="submit">
                  Find Artisan
                </button>
              </div>
            </form>
          </div>

          <div className="h-full min-h-[calc(100dvh-96px)] overflow-hidden rounded-[30px] bg-[var(--color-soft)] shadow-[0_22px_52px_var(--shadow-soft)] max-[720px]:min-h-[360px]">
            <img className="h-full w-full object-cover max-[720px]:h-[360px]" src={heroImage} alt="Artisan repairing a kitchen sink" />
          </div>
        </section>

        <section className="mt-[18px]">
          <div className="mb-8 flex items-center justify-between gap-5">
            <h2 className="m-0 text-[26px] font-medium text-[var(--color-ink)]">Categories</h2>
            <button className="bg-transparent p-0 text-base font-medium text-[var(--color-accent-bright)] hover:text-[var(--color-accent-dark)]" type="button" onClick={() => openCategories()}>
              View all categories
            </button>
          </div>
          <div className="grid grid-cols-7 justify-between gap-4 max-[1180px]:grid-cols-4 max-[720px]:grid-cols-2">
            {visibleCategories.map((category) => (
              <button
                className="grid min-h-[130px] place-items-center gap-4 rounded-md bg-[var(--color-soft)] px-6 py-4 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent-dark)]"
                key={category.id}
                type="button"
                onClick={() => openCategories({ categoryId: category.id })}
              >
                <AppIcon
                  icon={categoryIcon(category.iconKey)}
                  size={64}
                  className="text-[var(--color-primary)]"
                />
                {category.name}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-8 flex items-center justify-between gap-5">
            <h2 className="m-0 text-[26px] font-medium text-[var(--color-ink)]">Recommended</h2>
            <button className="bg-transparent p-0 text-base font-medium text-[var(--color-accent-bright)] hover:text-[var(--color-accent-dark)]" type="button" onClick={() => openCategories()}>
              Browse artisans
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3.5 max-[1180px]:grid-cols-1">
            {offerings.length > 0
              ? offerings.slice(0, 3).map((offering) => {
                  const artisanName = capitalizeLeadingCharacter(offering.artisan?.displayName || 'Approved artisan');

                  return (
                    <article className="grid gap-[18px] rounded-lg border border-[var(--color-input-border)] bg-[var(--color-surface-raised)] p-2.5" key={offering.id}>
                      <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-start gap-4 max-[720px]:grid-cols-1">
                        <ProfileAvatar
                          name={artisanName}
                          imageUrl={artisanProfileImageUrl(offering.artisan)}
                          className="h-16 w-16"
                          textClassName="text-2xl"
                        />
                        <div>
                          <h3 className="my-1.5 text-[21px] font-medium text-[var(--color-ink)]">{artisanName}</h3>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-[var(--color-accent-wash)] px-2.5 py-[3px] text-xs text-[var(--color-accent-bright)]">{offering.category?.name || 'Service'}</span>
                            <span className="rounded-full bg-[var(--color-accent-wash)] px-2.5 py-[3px] text-xs text-[var(--color-accent-bright)]">{offering.title}</span>
                          </div>
                        </div>
                        <small className="mt-3 text-sm text-[var(--color-ink)]">{offering.artisan?.area || offering.artisan?.city || 'Nearby'}</small>
                      </div>
                      <div className="grid grid-cols-[auto_auto_1fr] items-center gap-2.5 pl-20 max-[720px]:grid-cols-1 max-[720px]:pl-0">
                        <RatingStars />
                        <span>
                          {offering.artisan?.avgRating || '4.0'}({offering.artisan?.ratingCount || 0})
                        </span>
                        <strong className="justify-self-end text-[21px] font-medium text-[var(--color-ink)] max-[720px]:justify-self-start">
                          From {money(offering.priceFrom)}
                        </strong>
                      </div>
                      <button
                        className="min-h-14 rounded-[14px] bg-[var(--color-ink)] font-semibold text-[var(--color-paper)] hover:bg-[var(--color-ink-panel)]"
                        type="button"
                        onClick={() => {
                          if (offering.artisan?.id) {
                            navigate(
                              buildBookJobPath({
                                artisanId: offering.artisan.id,
                                offeringId: offering.id,
                              })
                            );
                            return;
                          }

                          openCategories();
                        }}
                      >
                        Book
                      </button>
                    </article>
                  );
                })
              : customerDashboardFallbackRecommendations.map((artisan) => {
                  const artisanName = capitalizeLeadingCharacter(artisan.name);

                  return (
                    <article className="grid gap-[18px] rounded-lg border border-[var(--color-input-border)] bg-[var(--color-surface-raised)] p-2.5" key={artisan.id}>
                      <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-start gap-4 max-[720px]:grid-cols-1">
                        <ProfileAvatar
                          name={artisanName}
                          imageUrl={artisan.imageUrl}
                          className="h-16 w-16"
                          textClassName="text-2xl"
                        />
                        <div>
                          <h3 className="my-1.5 text-[21px] font-medium text-[var(--color-ink)]">{artisanName}</h3>
                          <div className="flex flex-wrap gap-2">
                            {artisan.tags.map((tag) => (
                              <span className="rounded-full bg-[var(--color-accent-wash)] px-2.5 py-[3px] text-xs text-[var(--color-accent-bright)]" key={tag}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <small className="mt-3 text-sm text-[var(--color-ink)]">{artisan.distance}</small>
                      </div>
                      <div className="grid grid-cols-[auto_auto_1fr] items-center gap-2.5 pl-20 max-[720px]:grid-cols-1 max-[720px]:pl-0">
                        <RatingStars />
                        <span>{artisan.rating}</span>
                        <strong className="justify-self-end text-[21px] font-medium text-[var(--color-ink)] max-[720px]:justify-self-start">
                          {artisan.price}
                        </strong>
                      </div>
                      <button className="min-h-14 rounded-[14px] bg-[var(--color-ink)] font-semibold text-[var(--color-paper)] hover:bg-[var(--color-ink-panel)]" type="button" onClick={() => openCategories()}>
                        Book
                      </button>
                    </article>
                  );
                })}
          </div>
        </section>
      </main>
    </div>
  );
}
