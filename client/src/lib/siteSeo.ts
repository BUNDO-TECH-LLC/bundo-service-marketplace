/** Public site URL and SEO helpers. Additive only — never throws. */

export const SITE_ORIGIN = 'https://www.bundo.ng';

export const DEFAULT_DOCUMENT_TITLE = 'Bundo | Quality home services on demand';

export const DEFAULT_META_DESCRIPTION =
  'Book trusted local artisans for cleaning, repairs, and home services across Nigeria. Discover approved professionals near you on Bundo.';

const TITLE_SUFFIX = ' | Bundo';

export function formatDocumentTitle(pageTitle: string) {
  const trimmed = pageTitle.trim();
  if (!trimmed) {
    return DEFAULT_DOCUMENT_TITLE;
  }

  if (trimmed === DEFAULT_DOCUMENT_TITLE || trimmed.endsWith(TITLE_SUFFIX) || /\|\s*Bundo\s*$/.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}${TITLE_SUFFIX}`;
}

type ArtisanTitleInput = {
  displayName?: string | null;
  city?: string | null;
};

/**
 * Resolve a browser tab title from the current path.
 * Private/app routes get generic titles (they are disallowed in robots.txt).
 */
export function documentTitleForPath(
  pathname: string,
  options?: { artisan?: ArtisanTitleInput | null; helpTopicTitle?: string | null }
) {
  const path = pathname.replace(/\/+$/, '') || '/';

  if (path === '/') {
    return DEFAULT_DOCUMENT_TITLE;
  }

  if (path === '/marketplace') {
    return formatDocumentTitle('Browse services near you');
  }

  if (path === '/terms') {
    return formatDocumentTitle('Terms of Service');
  }

  if (path === '/privacy') {
    return formatDocumentTitle('Privacy Policy');
  }

  if (path === '/help') {
    return formatDocumentTitle('Help Center');
  }

  if (path.startsWith('/help/')) {
    const topic = options?.helpTopicTitle?.trim();
    return formatDocumentTitle(topic || 'Help Center');
  }

  if (path.startsWith('/artisans/')) {
    const name = options?.artisan?.displayName?.trim();
    const city = options?.artisan?.city?.trim();
    if (name && city) {
      return formatDocumentTitle(`${name} — ${city}`);
    }
    if (name) {
      return formatDocumentTitle(name);
    }
    return formatDocumentTitle('Artisan profile');
  }

  if (path.startsWith('/workspace')) {
    return formatDocumentTitle('Workspace');
  }

  if (path.startsWith('/admin')) {
    return formatDocumentTitle('Admin');
  }

  if (path.startsWith('/artisan/onboarding')) {
    return formatDocumentTitle('Artisan onboarding');
  }

  if (path === '/onboarding/profile') {
    return formatDocumentTitle('Complete your profile');
  }

  if (path === '/login') {
    return formatDocumentTitle('Log in');
  }

  if (path === '/signup' || path === '/create-account') {
    return formatDocumentTitle('Sign up');
  }

  if (path === '/forgot-password') {
    return formatDocumentTitle('Reset password');
  }

  if (path === '/verify-email') {
    return formatDocumentTitle('Verify email');
  }

  return DEFAULT_DOCUMENT_TITLE;
}

export function applyResolvedDocumentTitle(title: string) {
  try {
    document.title = title.trim() || DEFAULT_DOCUMENT_TITLE;
  } catch {
    // Ignore — SEO helpers must never break the app.
  }
}

export function setMetaDescription(description: string) {
  try {
    const content = description.trim() || DEFAULT_META_DESCRIPTION;
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'description');
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  } catch {
    // Ignore.
  }
}

export function metaDescriptionForPath(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/';

  if (path === '/marketplace') {
    return 'Browse approved artisans and home services near you on Bundo. Filter by location, category, and price.';
  }

  if (path === '/terms') {
    return 'Read the Bundo Terms of Service for bookings, payments, messaging, and artisan marketplace use.';
  }

  if (path === '/privacy') {
    return 'Read the Bundo Privacy Policy to understand how we collect, use, and protect your information.';
  }

  if (path === '/help' || path.startsWith('/help/')) {
    return 'Find answers about booking services, artisan onboarding, payments, disputes, and support on Bundo.';
  }

  if (path.startsWith('/artisans/')) {
    return 'View this artisan’s services, ratings, and availability on Bundo.';
  }

  return DEFAULT_META_DESCRIPTION;
}
