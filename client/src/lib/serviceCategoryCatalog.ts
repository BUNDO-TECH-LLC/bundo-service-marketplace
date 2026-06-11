import catalog from '../../../shared/service-categories.json';
import type { Category } from '../types';

export type ServiceCategoryDefinition = {
  name: string;
  slug: string;
  iconKey: string;
  description: string;
};

export const SERVICE_CATEGORY_CATALOG = catalog as ServiceCategoryDefinition[];

const catalogBySlug = new Map(SERVICE_CATEGORY_CATALOG.map((entry) => [entry.slug, entry]));

export const SERVICE_CATEGORY_SLUGS = new Set(SERVICE_CATEGORY_CATALOG.map((entry) => entry.slug));

/** High-demand categories surfaced on the homepage and customer dashboard. */
export const POPULAR_CATEGORY_SLUGS = [
  'cleaning-laundry-fumigation',
  'plumbing',
  'electrical-inverter-odu',
  'ac-refrigeration',
  'barbing',
  'carpentry-interior',
] as const;

export const HOMEPAGE_POPULAR_CATEGORY_LIMIT = 5;
export const DASHBOARD_POPULAR_CATEGORY_LIMIT = 6;

export type CatalogCategoryRow = ServiceCategoryDefinition & {
  category: Category;
};

export function getServiceCategoryDefinition(slug: string) {
  return catalogBySlug.get(slug);
}

export function sortCategoriesByCatalog(categories: Category[]) {
  const order = SERVICE_CATEGORY_CATALOG.map((entry) => entry.slug);

  return [...categories].sort((left, right) => {
    const leftIndex = order.indexOf(left.slug);
    const rightIndex = order.indexOf(right.slug);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.name.localeCompare(right.name);
    }
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

export function listCatalogCategories(categories: Category[]) {
  const bySlug = new Map(categories.map((category) => [category.slug, category]));

  return SERVICE_CATEGORY_CATALOG.flatMap((entry) => {
    const category = bySlug.get(entry.slug);
    return category ? [{ category, ...entry }] : [];
  });
}

export function listPopularCatalogCategories(
  categories: Category[],
  limit: number = HOMEPAGE_POPULAR_CATEGORY_LIMIT
) {
  const bySlug = new Map(listCatalogCategories(categories).map((row) => [row.slug, row]));

  return POPULAR_CATEGORY_SLUGS.slice(0, limit).flatMap((slug) => {
    const row = bySlug.get(slug);
    return row ? [row] : [];
  });
}
