import { Link } from 'react-router-dom';

type OnboardingNavFooterProps = {
  backTo?: string;
  backLabel?: string;
  skipTo?: string;
  skipLabel?: string;
  onSkip?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextType?: 'button' | 'submit';
  nextForm?: string;
  nextWide?: boolean;
};

export function OnboardingNavFooter({
  backTo,
  backLabel = 'Back',
  skipTo,
  skipLabel = 'Skip',
  onSkip,
  onNext,
  nextLabel = 'Next',
  nextDisabled = false,
  nextType = 'button',
  nextForm,
  nextWide = false,
}: OnboardingNavFooterProps) {
  const leftAction =
    backTo != null ? (
      <Link
        to={backTo}
        className="inline-flex min-h-12 min-w-[120px] items-center justify-center rounded-xl bg-[var(--color-ink)] px-6 text-base font-bold text-white no-underline hover:bg-[var(--color-black)]"
      >
        {backLabel}
      </Link>
    ) : skipTo != null ? (
      <Link
        to={skipTo}
        className="inline-flex min-h-12 min-w-[120px] items-center justify-center rounded-xl bg-[var(--color-ink)] px-6 text-base font-bold text-white no-underline hover:bg-[var(--color-black)]"
      >
        {skipLabel}
      </Link>
    ) : onSkip ? (
      <button
        type="button"
        className="inline-flex min-h-12 min-w-[120px] items-center justify-center rounded-xl bg-[var(--color-ink)] px-6 text-base font-bold text-white hover:bg-[var(--color-black)]"
        onClick={onSkip}
      >
        {skipLabel}
      </button>
    ) : (
      <span />
    );

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
      {leftAction}

      <button
        className={`inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--color-accent-bright)] px-6 text-base font-bold text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-55 ${nextWide ? 'min-w-[220px] whitespace-nowrap' : 'min-w-[120px]'}`}
        type={nextType}
        form={nextForm}
        onClick={nextType === 'button' ? onNext : undefined}
        disabled={nextDisabled}
      >
        {nextLabel}
      </button>
    </div>
  );
}
