import { artisanOnboardingSteps } from './onboardingPaths';

type OnboardingStepperProps = {
  currentStep: number;
};

export function OnboardingStepper({ currentStep }: OnboardingStepperProps) {
  return (
    <ol className="m-0 grid list-none grid-cols-2 gap-x-2 gap-y-5 p-0 sm:grid-cols-4">
      {artisanOnboardingSteps.map((step) => {
        const isActive = step.step === currentStep;
        const isComplete = step.step < currentStep;
        const active = isActive || isComplete;

        return (
          <li key={step.id} className="grid justify-items-center gap-2 text-center">
            <span
              className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${
                active
                  ? 'bg-[var(--color-accent-bright)] text-white'
                  : 'bg-[var(--color-line-softer)] text-[var(--color-text-faint)]'
              } ${isActive ? 'ring-4 ring-[var(--color-accent-soft)]' : ''}`}
            >
              {step.step}
            </span>
            <span
              className={`max-w-[120px] text-xs leading-tight font-semibold sm:text-sm ${
                isActive ? 'text-[var(--color-ink)]' : 'text-[var(--color-text-muted)]'
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
