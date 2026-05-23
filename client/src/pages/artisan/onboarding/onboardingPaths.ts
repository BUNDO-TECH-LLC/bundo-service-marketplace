export type OnboardingStepId = 'basic-info' | 'pricing' | 'portfolio' | 'availability';

export type OnboardingStepMeta = {
  id: OnboardingStepId;
  step: number;
  label: string;
  path: string;
  title: string;
};

export const artisanOnboardingSteps: OnboardingStepMeta[] = [
  {
    id: 'basic-info',
    step: 1,
    label: 'Basic info',
    path: '/artisan/onboarding/basic-info',
    title: 'Set up your artisan profile',
  },
  {
    id: 'pricing',
    step: 2,
    label: 'Services & pricing',
    path: '/artisan/onboarding/pricing',
    title: 'Set up your artisan profile',
  },
  {
    id: 'portfolio',
    step: 3,
    label: 'Portfolio',
    path: '/artisan/onboarding/portfolio',
    title: 'Set up your artisan profile',
  },
  {
    id: 'availability',
    step: 4,
    label: 'Availability & submit',
    path: '/artisan/onboarding/availability',
    title: 'Set up your artisan profile',
  },
];

export function getOnboardingStepByPath(pathname: string) {
  return artisanOnboardingSteps.find((step) => pathname.endsWith(step.id)) ?? artisanOnboardingSteps[0];
}
