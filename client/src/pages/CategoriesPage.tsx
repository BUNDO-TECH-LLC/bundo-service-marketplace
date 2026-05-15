import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import bundoLogo from '../assets/BundoLogo.png';
import { CustomerHeader } from '../components/customer/CustomerHeader';
import { EmptyState } from '../components/EmptyState';
import { AppIcon } from '../components/ui/AppIcon';
import { ProfileAvatar } from '../components/ui/ProfileAvatar';
import { browseLocationAreaOptions, customerDashboardFallbackCategories } from '../constants/data';
import { api, ApiError } from '../lib/api';
import { resolveApiSession } from '../lib/authSession';
import { categoryIcon } from '../lib/categoryIcon';
import { auth } from '../lib/firebase';
import { artisanProfileImageUrl } from '../lib/profileImage';
import { capitalizeLeadingCharacter } from '../lib/userDisplayName';
import type { ApiUser, Category, Offering } from '../types';
import {
  appRoutes,
  buildArtisanProfilePath,
  buildCategoriesPath,
  buildCustomerWorkspacePath,
} from '../routes/paths';
import './CategoriesPage.css';

type OfferingsApiResponse = {
  offerings: Offering[];
  meta?: { page: number; limit: number; total: number };
};

const DEFAULT_RESULT_LIMIT = 20;
const CATALOG_GRID_PAGE = 20;

const OFFERING_SORT_VALUES = ['newest', 'rating', 'price_low', 'price_high'] as const;
type OfferingSortValue = (typeof OFFERING_SORT_VALUES)[number];

function parseOfferingSort(raw: string | null): OfferingSortValue {
  if (raw && OFFERING_SORT_VALUES.includes(raw as OfferingSortValue)) {
    return raw as OfferingSortValue;
  }
  return 'newest';
}

function fallbackCategoriesAsCategories(): Category[] {
  return customerDashboardFallbackCategories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.id,
    iconKey: c.iconKey,
  }));
}

function ResultStars() {
  return (
    <span className="categories-stars" aria-label="Rating">
      {Array.from({ length: 5 }).map((_, index) => (
        <AppIcon key={index} icon="mdi:star" size={16} />
      ))}
    </span>
  );
}

export default function CategoriesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const state = searchParams.get('state') ?? '';
  const categoryId = searchParams.get('categoryId') ?? '';
  const minPrice = searchParams.get('minPrice') ?? '';
  const maxPrice = searchParams.get('maxPrice') ?? '';
  const ratingOrder = (searchParams.get('ratingOrder') as 'any' | 'best' | 'low') || 'any';
  const offeringSort = parseOfferingSort(searchParams.get('sort'));
  const limitParam = Number(searchParams.get('limit') || String(DEFAULT_RESULT_LIMIT));
  const resultLimit = Number.isFinite(limitParam)
    ? Math.min(120, Math.max(12, limitParam))
    : DEFAULT_RESULT_LIMIT;

  const isResultsView = Boolean(q.trim() || categoryId || minPrice.trim() || maxPrice.trim());

  const [searchDraft, setSearchDraft] = useState(q);
  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [me, setMe] = useState<ApiUser | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [offeringsMeta, setOfferingsMeta] = useState<{ total: number; page: number; limit: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [catalogNotice, setCatalogNotice] = useState('');
  const [gridVisibleCount, setGridVisibleCount] = useState(CATALOG_GRID_PAGE);

  useEffect(() => {
    if (!auth) {
      return undefined;
    }

    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        setMe(null);
        return;
      }

      try {
        const session = await resolveApiSession(user);
        setMe(session.user);
      } catch {
        setMe(null);
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    void api<{ categories?: Category[] }>('/categories')
      .then((res) => {
        if (cancelled) {
          return;
        }
        const list = Array.isArray(res.categories) ? res.categories : [];
        if (list.length > 0) {
          setCategories(list);
          setCatalogNotice('');
          return;
        }
        setCategories(fallbackCategoriesAsCategories());
        setCatalogNotice(
          'The API returned no categories. Using sample categories for this screen. Run the database seed on the server (npm run db:seed --prefix server) to load real categories.'
        );
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setCategories(fallbackCategoriesAsCategories());
        const message =
          error instanceof ApiError
            ? error.message
            : 'Could not load categories. Check that the API server is running and VITE_API_BASE_URL matches the server URL.';
        setCatalogNotice(message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isResultsView || categories.length === 0) {
      return undefined;
    }

    let cancelled = false;

    void (async () => {
      const entries = await Promise.all(
        categories.map(async (c) => {
          const params = new URLSearchParams({ page: '1', limit: '1', sort: offeringSort });
          params.set('categoryId', c.id);
          if (state) {
            params.set('state', state);
          }

          try {
            const res = await api<OfferingsApiResponse>(`/offerings?${params.toString()}`);
            return [c.id, res.meta?.total ?? res.offerings.length] as const;
          } catch {
            return [c.id, 0] as const;
          }
        })
      );

      if (!cancelled) {
        setCategoryCounts(Object.fromEntries(entries));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [categories, isResultsView, state, offeringSort]);

  useEffect(() => {
    if (!isResultsView) {
      setOfferings([]);
      setOfferingsMeta(null);
      return undefined;
    }

    const params = new URLSearchParams({
      page: '1',
      limit: String(resultLimit),
      sort: offeringSort,
    });

    if (state) {
      params.set('state', state);
    }
    if (q.trim()) {
      params.set('q', q.trim());
    }
    if (categoryId) {
      params.set('categoryId', categoryId);
    }
    if (minPrice.trim()) {
      params.set('minPrice', minPrice.trim());
    }
    if (maxPrice.trim()) {
      params.set('maxPrice', maxPrice.trim());
    }

    setBusy(true);
    setNotice('');

    void api<OfferingsApiResponse>(`/offerings?${params.toString()}`)
      .then((res) => {
        setOfferings(res.offerings);
        setOfferingsMeta({
          total: Math.max(res.meta?.total ?? 0, res.offerings.length),
          page: res.meta?.page ?? 1,
          limit: res.meta?.limit ?? resultLimit,
        });
      })
      .catch(() => {
        setNotice('Could not load results right now.');
        setOfferings([]);
        setOfferingsMeta(null);
      })
      .finally(() => {
        setBusy(false);
      });

    return undefined;
  }, [isResultsView, state, q, categoryId, minPrice, maxPrice, resultLimit, offeringSort]);

  const sortedOfferings = useMemo(() => {
    const list = [...offerings];
    if (ratingOrder === 'best') {
      list.sort((a, b) => {
        const rb = b.artisan?.avgRating ?? 0;
        const ra = a.artisan?.avgRating ?? 0;
        if (rb !== ra) {
          return rb - ra;
        }
        return (b.artisan?.ratingCount ?? 0) - (a.artisan?.ratingCount ?? 0);
      });
    } else if (ratingOrder === 'low') {
      list.sort((a, b) => (a.artisan?.avgRating ?? 0) - (b.artisan?.avgRating ?? 0));
    }
    return list;
  }, [offerings, ratingOrder]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  );

  const greetingName = useMemo(() => {
    const email = firebaseUser?.email || me?.email;
    return email ? email.split('@')[0] : null;
  }, [firebaseUser?.email, me?.email]);

  function patchSearchParams(
    mutate: (next: URLSearchParams) => void,
    options?: { preserveLimit?: boolean }
  ) {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    next.delete('page');
    if (!options?.preserveLimit) {
      next.delete('limit');
    }
    setSearchParams(next, { replace: true });
  }

  function openPrimaryDashboard() {
    if (me?.role === 'CUSTOMER') {
      navigate(appRoutes.customerDashboard);
      return;
    }
    if (me?.role === 'ARTISAN') {
      navigate(appRoutes.artisanDashboard);
      return;
    }
    if (me?.role === 'ADMIN') {
      navigate(appRoutes.admin);
      return;
    }
    navigate(appRoutes.login);
  }

  async function logout() {
    if (auth) {
      await signOut(auth);
    }
    navigate(appRoutes.home, { replace: true });
  }

  function openWorkspace(section: 'bookings' | 'messages') {
    navigate(buildCustomerWorkspacePath(section));
  }

  function browseAllCategories() {
    setSearchParams(new URLSearchParams(), { replace: true });
    setGridVisibleCount(CATALOG_GRID_PAGE);
  }

  function submitHeaderSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    patchSearchParams((next) => {
      if (searchDraft.trim()) {
        next.set('q', searchDraft.trim());
      } else {
        next.delete('q');
      }
      if (state) {
        next.set('state', state);
      }
    });
  }

  function applyMainSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    patchSearchParams((next) => {
      if (searchDraft.trim()) {
        next.set('q', searchDraft.trim());
      } else {
        next.delete('q');
      }
    });
  }

  const visibleCatalogCategories = categories.slice(0, gridVisibleCount);
  const totalCategories = categories.length;
  const canShowMoreGrid = gridVisibleCount < totalCategories;

  const totalResults = offeringsMeta?.total ?? 0;
  const loadedCount = sortedOfferings.length;
  const canLoadMoreResults = isResultsView && totalResults > loadedCount;

  function loadMoreResults() {
    patchSearchParams(
      (next) => {
        const current = Number(next.get('limit') || String(DEFAULT_RESULT_LIMIT));
        const bumped = Math.min(120, current + 20);
        next.set('limit', String(bumped));
      },
      { preserveLimit: true }
    );
  }

  function clearLocationFilter() {
    patchSearchParams((next) => {
      next.delete('state');
    });
  }

  const showCustomerChrome = me?.role === 'CUSTOMER' && Boolean(firebaseUser);

  const resultsTitle = selectedCategory?.name || (q.trim() ? q.trim() : 'Search results');

  return (
    <div className="categories-page">
      {showCustomerChrome ? (
        <CustomerHeader
          firebaseUser={firebaseUser}
          me={me}
          activeNav="categories"
          searchContent={
            <form
              className="grid w-[min(100%,402px)] justify-self-end grid-cols-[minmax(170px,1fr)_minmax(150px,0.92fr)] items-center rounded-lg border border-[var(--color-input-border)] bg-[var(--color-paper)] max-[1180px]:w-full max-[1180px]:justify-self-stretch max-[720px]:grid-cols-1"
              onSubmit={submitHeaderSearch}
            >
              <label className="flex min-w-0 items-center gap-2.5 px-3 py-2.5 first:border-r first:border-[var(--color-line)] max-[720px]:first:border-r-0 max-[720px]:first:border-b">
                <AppIcon icon="mingcute:search-line" className="text-2xl leading-none text-[var(--color-ink)]" size={24} />
                <input
                  className="min-w-0 border-0 bg-transparent p-0 font-medium text-[var(--color-ink)] outline-none"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Search for artisan"
                  type="search"
                  aria-label="Search for artisan"
                />
              </label>
              <div className="flex min-w-0 items-center px-3 py-2.5">
                <select
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-[var(--color-ink)] outline-none"
                  value={state}
                  onChange={(event) => {
                    patchSearchParams((next) => {
                      if (event.target.value) {
                        next.set('state', event.target.value);
                      } else {
                        next.delete('state');
                      }
                    });
                  }}
                  aria-label="Location"
                >
                  {browseLocationAreaOptions.map((opt) => (
                    <option key={opt.value || 'all'} value={opt.value}>
                      {opt.label === 'All areas' ? 'Lagos, Nigeria' : opt.label}
                    </option>
                  ))}
                </select>
                <AppIcon icon="mdi:chevron-down" size={18} />
              </div>
            </form>
          }
          onOpenDashboard={() => navigate(appRoutes.customerDashboard)}
          onOpenMarketplace={() => navigate(buildCategoriesPath({}))}
          onOpenNotifications={() => navigate(buildCustomerWorkspacePath('notifications'))}
          onOpenWorkspace={openWorkspace}
          onLogout={logout}
        />
      ) : (
        <header className="app-screen-gutter border-b border-[var(--color-line)] bg-[var(--color-paper)] py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              className="inline-flex items-center gap-3 bg-transparent text-[var(--color-ink)]"
              type="button"
              onClick={() => navigate(appRoutes.home)}
            >
              <img className="h-12 w-12 rounded-xl object-cover" src={bundoLogo} alt="Bundo logo" />
              <span className="text-3xl font-black">Bundo</span>
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <button className="secondary-button" type="button" onClick={() => navigate(appRoutes.help)}>
                Help
              </button>
              <button className="primary-button" type="button" onClick={openPrimaryDashboard}>
                {greetingName ? `Open ${greetingName}` : 'Log in'}
              </button>
            </div>
          </div>
        </header>
      )}

      <main className="categories-main app-screen-gutter">
        {notice ? <div className="notice mb-4">{notice}</div> : null}
        {!isResultsView && catalogNotice ? <div className="notice mb-4">{catalogNotice}</div> : null}

        {!isResultsView ? (
          <>
            <div className="categories-page-head">
              <h1 className="categories-page-title">Browse Categories</h1>
              <form className="categories-search-wide categories-search-wrap" onSubmit={applyMainSearch}>
                <span className="categories-search-icon">
                  <AppIcon icon="mingcute:search-line" size={22} />
                </span>
                <input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Search for artisan"
                  type="search"
                  aria-label="Search for artisan"
                />
              </form>
            </div>

            <div className="categories-toolbar categories-toolbar--catalog">
              <div className="categories-all-categories">
                <AppIcon
                  icon="mdi:view-grid-outline"
                  className="categories-all-categories__grid-icon"
                  size={20}
                  aria-hidden
                />
                <select
                  className="categories-all-categories__select"
                  value={categoryId}
                  onChange={(event) => {
                    const value = event.target.value;
                    patchSearchParams((next) => {
                      if (value) {
                        next.set('categoryId', value);
                      } else {
                        next.delete('categoryId');
                      }
                    });
                  }}
                  aria-label="All categories"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <AppIcon
                  icon="mdi:chevron-down"
                  className="categories-all-categories__chevron"
                  size={20}
                  aria-hidden
                />
              </div>

              <span className="categories-toolbar-label">Filter by:</span>

              <div className="categories-filter-select categories-filter-select--location">
                <AppIcon icon="mingcute:location-line" className="categories-filter-select__icon" size={20} aria-hidden />
                <select
                  className="categories-filter-select__native"
                  value={state}
                  onChange={(event) => {
                    const value = event.target.value;
                    patchSearchParams((next) => {
                      if (value) {
                        next.set('state', value);
                      } else {
                        next.delete('state');
                      }
                    });
                  }}
                  aria-label="Location"
                >
                  {browseLocationAreaOptions.map((opt) => (
                    <option key={opt.value || 'all'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <AppIcon icon="mdi:chevron-down" className="categories-filter-select__chevron" size={18} aria-hidden />
              </div>

              <div className="categories-filter-select">
                <select
                  className="categories-filter-select__native categories-filter-select__native--rating"
                  value={ratingOrder}
                  onChange={(event) => {
                    patchSearchParams((next) => {
                      next.set('ratingOrder', event.target.value);
                    });
                  }}
                  aria-label="Rating"
                >
                  <option value="any">Any rating</option>
                  <option value="best">Best rated to lowest</option>
                  <option value="low">Lowest to best rated</option>
                </select>
                <AppIcon icon="mdi:chevron-down" className="categories-filter-select__chevron" size={18} aria-hidden />
              </div>

              <div className="categories-toolbar-spacer" aria-hidden />

              <span className="categories-toolbar-label categories-toolbar-label--sort">Sort by:</span>
              <div className="categories-filter-select categories-filter-select--sort">
                <AppIcon icon="mdi:swap-vertical" className="categories-filter-select__icon" size={18} aria-hidden />
                <select
                  className="categories-filter-select__native"
                  value={offeringSort}
                  onChange={(event) => {
                    patchSearchParams((next) => {
                      next.set('sort', event.target.value);
                    });
                  }}
                  aria-label="Sort"
                >
                  <option value="newest">Nearest</option>
                  <option value="rating">Best rated</option>
                  <option value="price_low">Price: low to high</option>
                  <option value="price_high">Price: high to low</option>
                </select>
                <AppIcon icon="mdi:chevron-down" className="categories-filter-select__chevron" size={18} aria-hidden />
              </div>
            </div>

            <div className="categories-grid">
              {visibleCatalogCategories.map((category) => {
                const count = categoryCounts[category.id];
                const countLabel =
                  count === undefined ? '…' : `${count} professional${count === 1 ? '' : 's'}`;

                return (
                  <button
                    key={category.id}
                    type="button"
                    className="categories-card"
                    onClick={() => {
                      patchSearchParams((next) => {
                        next.set('categoryId', category.id);
                      });
                    }}
                  >
                    <AppIcon icon={categoryIcon(category.iconKey)} size={64} className="categories-card__icon" />
                    <p className="categories-card-name">{category.name}</p>
                    <p className="categories-card-count">{countLabel}</p>
                  </button>
                );
              })}
            </div>

            {canShowMoreGrid ? (
              <button
                type="button"
                className="categories-view-more"
                onClick={() => setGridVisibleCount((n) => Math.min(n + CATALOG_GRID_PAGE, totalCategories))}
              >
                View More Categories
                <AppIcon icon="mdi:chevron-down" size={22} />
              </button>
            ) : null}

            <p className="categories-showing">
              Showing {Math.min(gridVisibleCount, totalCategories)} Of {totalCategories} service categories
            </p>
          </>
        ) : (
          <>
            <div className="categories-page-head">
              <h1 className="categories-page-title">{resultsTitle}</h1>
              <form className="categories-search-wide categories-search-wrap" onSubmit={applyMainSearch}>
                <span className="categories-search-icon">
                  <AppIcon icon="mingcute:search-line" size={22} />
                </span>
                <input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Search for artisan"
                  type="search"
                  aria-label="Search for artisan"
                />
              </form>
            </div>

            <div className="categories-toolbar categories-toolbar--results">
              <select
                className="categories-pill-select categories-pill-select--dark"
                value={categoryId}
                onChange={(event) => {
                  const value = event.target.value;
                  patchSearchParams((next) => {
                    if (value) {
                      next.set('categoryId', value);
                    } else {
                      next.delete('categoryId');
                    }
                  });
                }}
                aria-label="Category"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <span className="categories-toolbar-label">Filter by:</span>
              <select
                className="categories-pill-select"
                value={state}
                onChange={(event) => {
                  const value = event.target.value;
                  patchSearchParams((next) => {
                    if (value) {
                      next.set('state', value);
                    } else {
                      next.delete('state');
                    }
                  });
                }}
                aria-label="Location"
              >
                {browseLocationAreaOptions.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                className="categories-pill-select"
                value={ratingOrder}
                onChange={(event) => {
                  patchSearchParams((next) => {
                    next.set('ratingOrder', event.target.value);
                  });
                }}
                aria-label="Rating"
              >
                <option value="any">Any rating</option>
                <option value="best">Best rated to lowest</option>
                <option value="low">Lowest to best rated</option>
              </select>

              <div className="categories-toolbar-spacer" aria-hidden />

              <span className="categories-toolbar-label categories-toolbar-label--sort">Sort by:</span>
              <div className="categories-filter-select categories-filter-select--sort">
                <AppIcon icon="mdi:swap-vertical" className="categories-filter-select__icon" size={18} aria-hidden />
                <select
                  className="categories-filter-select__native"
                  value={offeringSort}
                  onChange={(event) => {
                    patchSearchParams((next) => {
                      next.set('sort', event.target.value);
                    });
                  }}
                  aria-label="Sort"
                >
                  <option value="newest">Nearest</option>
                  <option value="rating">Best rated</option>
                  <option value="price_low">Price: low to high</option>
                  <option value="price_high">Price: high to low</option>
                </select>
                <AppIcon icon="mdi:chevron-down" className="categories-filter-select__chevron" size={18} aria-hidden />
              </div>
            </div>

            {sortedOfferings.length === 0 && !busy ? (
              <EmptyState
                title="No results in this area"
                body="Try adjusting your search, category, or location to find more artisans."
              />
            ) : (
              <div className="categories-results-list">
                {sortedOfferings.map((offering) => {
                  const artisanName = capitalizeLeadingCharacter(
                    offering.artisan?.displayName || 'Approved artisan'
                  );
                  const subtitle = offering.title || offering.category?.name || 'Service';
                  const rating = offering.artisan?.avgRating ?? 0;
                  const ratingCount = offering.artisan?.ratingCount ?? 0;
                  const locationLabel =
                    [offering.artisan?.area, offering.artisan?.city].filter(Boolean).join(', ') || 'Nearby';

                  return (
                    <article key={offering.id} className="categories-result-row">
                      <ProfileAvatar
                        name={artisanName}
                        imageUrl={artisanProfileImageUrl(offering.artisan)}
                        className="h-16 w-16 shrink-0"
                        textClassName="text-xl"
                      />
                      <div className="categories-result-meta">
                        <h2 className="categories-result-name">{artisanName}</h2>
                        <p className="categories-result-sub">{subtitle}</p>
                        <div className="categories-result-tags">
                          <span className="categories-tag">Category</span>
                          <span className="categories-tag">{offering.category?.name || 'Service'}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                          <ResultStars />
                          <span>
                            {rating.toFixed(1)}({ratingCount})
                          </span>
                        </div>
                        <p className="categories-result-sub mt-1">
                          <span className="font-semibold text-[var(--color-ink)]">Distance</span>
                          <br />
                          {locationLabel}
                        </p>
                      </div>
                      <div className="categories-result-side">
                        <div className="categories-result-actions">
                          {offering.artisan?.id ? (
                            <>
                              <button
                                type="button"
                                className="categories-btn-dark"
                                onClick={() => navigate(buildArtisanProfilePath(offering.artisan!.id))}
                              >
                                View Profile
                              </button>
                              <button
                                type="button"
                                className="categories-btn-accent"
                                onClick={() => navigate(buildArtisanProfilePath(offering.artisan!.id))}
                              >
                                Book Service
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {sortedOfferings.length > 0 && !busy ? (
              <>
                {canLoadMoreResults ? (
                  <button type="button" className="categories-view-more mt-6" onClick={loadMoreResults}>
                    Load more results
                    <AppIcon icon="mdi:chevron-down" size={22} />
                  </button>
                ) : (
                  <div className="categories-end-block">
                    <div className="categories-end-icon" aria-hidden>
                      <AppIcon icon="mdi:emoticon-happy-outline" size={28} />
                    </div>
                    <h2 className="m-0 text-lg font-semibold">No more results in this area</h2>
                    <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--color-text-sub)]">
                      Try adjusting your search filter or changing your location to find more professionals.
                    </p>
                    <div className="categories-end-actions">
                      <button type="button" className="categories-btn-dark" onClick={clearLocationFilter}>
                        Change your location
                      </button>
                      <button type="button" className="categories-btn-outline" onClick={browseAllCategories}>
                        Browse all categories
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
