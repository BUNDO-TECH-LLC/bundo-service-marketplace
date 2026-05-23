import { phoneImage } from '../../lib/marketingAssets';

export function AppPromoSection() {
  return (
    <section className="px-6 py-12 lg:px-[7vw] xl:px-28">
      <div className="grid items-center gap-8 rounded-[32px] bg-[var(--color-soft)] px-8 py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-[var(--color-accent-bright)]">
            Mobile ready
          </p>
          <h2 className="m-0 text-[34px] font-medium text-[var(--color-ink)]">Manage bookings on the go.</h2>
          <p className="mt-4 max-w-[520px] text-[15px] leading-7 text-[var(--color-text-sub)]">
            The customer flow is being moved into dedicated screens so you can update the UI and functionality faster across web and mobile.
          </p>
        </div>
        <div className="overflow-hidden rounded-[28px] bg-[var(--color-paper)] p-3 shadow-[0_14px_36px_var(--shadow-light)]">
          <img className="h-[360px] w-full rounded-[22px] object-cover" src={phoneImage} alt="Person using the Bundo app on a phone" />
        </div>
      </div>
    </section>
  );
}
