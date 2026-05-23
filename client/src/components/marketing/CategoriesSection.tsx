import { categoryIcon } from '../../lib/categoryIcon';
import type { Category } from '../../types';
import { AppIcon } from '../ui/AppIcon';

type CategoriesSectionProps = {
  categories: Category[];
  onBrowseCategory: (categoryId?: string) => void;
};

export function CategoriesSection({ categories, onBrowseCategory }: CategoriesSectionProps) {
  return (
    <section className="px-6 py-12 lg:px-[7vw] xl:px-28">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-[var(--color-accent-bright)]">
            Popular categories
          </p>
          <h2 className="m-0 text-[34px] font-medium text-[var(--color-ink)]">Start with the service you need.</h2>
        </div>
        <button className="bg-transparent text-base font-semibold text-[var(--color-accent-bright)]" type="button" onClick={() => onBrowseCategory()}>
          Browse all
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {categories.map((category) => (
          <button
            className="grid min-h-[144px] place-items-center gap-3 rounded-[24px] border border-[var(--color-line)] bg-[var(--color-paper)] p-5 text-center shadow-[0_12px_28px_var(--shadow-light)] hover:border-[var(--color-accent-bright)]"
            key={category.id}
            type="button"
            onClick={() => onBrowseCategory(category.id)}
          >
            <AppIcon
              icon={categoryIcon(category.iconKey)}
              className="text-3xl text-[var(--color-accent-bright)]"
            />
            <span className="text-sm font-semibold text-[var(--color-ink)]">{category.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
