import type { FormEvent } from 'react';
import { heroImage } from '../../lib/marketingAssets';

type HeroSectionProps = {
  searchTerm: string;
  selectedState: string;
  states: readonly string[];
  onSearchTermChange: (value: string) => void;
  onSelectedStateChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function HeroSection({
  searchTerm,
  selectedState,
  states,
  onSearchTermChange,
  onSelectedStateChange,
  onSubmit,
}: HeroSectionProps) {
  return (
    <section className="grid min-h-[620px] grid-cols-[minmax(320px,1fr)_minmax(320px,0.95fr)] items-center gap-12 px-6 py-12 lg:px-[7vw] xl:px-28 max-[980px]:grid-cols-1">
      <div className="max-w-[620px]">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-[var(--color-accent-bright)]">
          Trusted local services
        </p>
        <h1 className="m-0 text-[52px] leading-[1.08] font-medium text-[var(--color-ink)] max-[720px]:text-[42px]">
          Book verified artisans without chasing referrals.
        </h1>
        <p className="mt-5 max-w-[540px] text-lg leading-8 text-[var(--color-text-sub)]">
          Search by service and location, compare approved professionals, and move from discovery to booking in one flow.
        </p>

        <form
          className="mt-8 grid gap-3 rounded-[24px] border border-[var(--color-line)] bg-[var(--color-paper)] p-3 shadow-[0_20px_45px_var(--shadow-soft)] md:grid-cols-[minmax(0,1fr)_220px_auto]"
          onSubmit={onSubmit}
        >
          <label className="grid gap-2 rounded-2xl border border-[var(--color-line)] px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">What do you need?</span>
            <input
              className="border-0 bg-transparent p-0 text-base text-[var(--color-ink)] outline-none"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Cleaning, plumbing, tailoring"
              type="search"
            />
          </label>

          <label className="grid gap-2 rounded-2xl border border-[var(--color-line)] px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Where?</span>
            <select
              className="border-0 bg-transparent p-0 text-base text-[var(--color-ink)] outline-none"
              value={selectedState}
              onChange={(event) => onSelectedStateChange(event.target.value)}
            >
              <option value="">All Nigeria</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>

          <button className="min-h-[72px] rounded-2xl bg-[var(--color-accent-button)] px-6 text-base font-semibold text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)]">
            Find artisans
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-[32px] bg-[var(--color-soft)] shadow-[0_22px_52px_var(--shadow-soft)]">
        <img className="h-full min-h-[420px] w-full object-cover" src={heroImage} alt="Artisan completing a home service" />
      </div>
    </section>
  );
}
