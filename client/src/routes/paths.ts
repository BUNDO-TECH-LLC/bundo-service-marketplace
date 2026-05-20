import type { WorkspaceSection } from '../appTypes';

export const appRoutes = {
  home: '/',
  categories: '/categories',
  /** Legacy path; router redirects to `/categories`. */
  marketplace: '/marketplace',
  help: '/help',
  login: '/login',
  signup: '/create-account',
  verifyEmail: '/verify-email',
  loading: '/loading',
  customerDashboard: '/customer/dashboard',
  customerBook: '/customer/book',
  customerMessages: '/customer/messages',
  customerWorkspace: '/customer/workspace',
  artisanDashboard: '/artisan/dashboard',
  artisanOnboarding: '/artisan/onboarding',
  artisanOnboardingBasicInfo: '/artisan/onboarding/basic-info',
  artisanOnboardingPricing: '/artisan/onboarding/pricing',
  artisanOnboardingPortfolio: '/artisan/onboarding/portfolio',
  artisanOnboardingAvailability: '/artisan/onboarding/availability',
  devArtisanOnboarding: '/dev/artisan/onboarding',
  devArtisanOnboardingBasicInfo: '/dev/artisan/onboarding/basic-info',
  devArtisanOnboardingPricing: '/dev/artisan/onboarding/pricing',
  devArtisanOnboardingPortfolio: '/dev/artisan/onboarding/portfolio',
  devArtisanOnboardingAvailability: '/dev/artisan/onboarding/availability',
  devArtisanDashboard: '/dev/artisan/dashboard',
  admin: '/admin',
} as const;

export type CategoriesPathInput = {
  q?: string;
  state?: string;
  categoryId?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  ratingOrder?: string;
  limit?: string;
  page?: string;
};

export function buildCategoriesPath(input?: CategoriesPathInput) {
  const params = new URLSearchParams();

  if (input?.q?.trim()) {
    params.set('q', input.q.trim());
  }

  if (input?.state?.trim()) {
    params.set('state', input.state.trim());
  }

  if (input?.categoryId?.trim()) {
    params.set('categoryId', input.categoryId.trim());
  }

  if (input?.minPrice?.trim()) {
    params.set('minPrice', input.minPrice.trim());
  }

  if (input?.maxPrice?.trim()) {
    params.set('maxPrice', input.maxPrice.trim());
  }

  if (input?.sort?.trim()) {
    params.set('sort', input.sort.trim());
  }

  if (input?.ratingOrder?.trim()) {
    params.set('ratingOrder', input.ratingOrder.trim());
  }

  if (input?.limit?.trim()) {
    params.set('limit', input.limit.trim());
  }

  if (input?.page?.trim()) {
    params.set('page', input.page.trim());
  }

  const query = params.toString();
  return query ? `${appRoutes.categories}?${query}` : appRoutes.categories;
}

/** @deprecated Prefer `buildCategoriesPath` */
export const buildMarketplacePath = buildCategoriesPath;

export function buildCustomerWorkspacePath(section?: WorkspaceSection) {
  if (section === 'messages') {
    return appRoutes.customerMessages;
  }

  if (!section) {
    return appRoutes.customerWorkspace;
  }

  return `${appRoutes.customerWorkspace}?section=${section}`;
}

export function buildArtisanDashboardPath(section?: WorkspaceSection) {
  if (!section) {
    return appRoutes.artisanDashboard;
  }

  return `${appRoutes.artisanDashboard}?section=${section}`;
}

export function buildArtisanProfilePath(artisanId: string) {
  return `/artisans/${artisanId}`;
}

export function buildBookJobPath(input: { artisanId: string; offeringId?: string }) {
  const params = new URLSearchParams({ artisanId: input.artisanId });

  if (input.offeringId?.trim()) {
    params.set('offeringId', input.offeringId.trim());
  }

  return `${appRoutes.customerBook}?${params}`;
}
