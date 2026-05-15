import { whySectionItems } from '../../constants/data';

export function WhySection() {
  return (
    <section className="px-6 py-12 lg:px-[7vw] xl:px-28">
      <div className="mb-8 max-w-[520px]">
        <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-[var(--color-accent-bright)]">
          Why Bundo
        </p>
        <h2 className="m-0 text-[34px] font-medium text-[var(--color-ink)]">A simpler way to hire trusted help.</h2>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {whySectionItems.map((item) => (
          <article
            className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-paper)] p-6 shadow-[0_14px_36px_var(--shadow-light)]"
            key={item.title}
          >
            <h3 className="m-0 text-xl font-semibold text-[var(--color-ink)]">{item.title}</h3>
            <p className="mt-3 text-[15px] leading-7 text-[var(--color-text-sub)]">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
