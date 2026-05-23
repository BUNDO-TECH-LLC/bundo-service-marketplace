import type { OnboardingStepId } from './onboardingPaths';

export const DEV_ONBOARDING_PREFIX = '/dev/artisan/onboarding';

export function isDevOnboardingPreview(pathname: string) {
  return pathname.startsWith(DEV_ONBOARDING_PREFIX);
}

export function onboardingStepPath(stepId: OnboardingStepId, devPreview: boolean) {
  const base = devPreview ? DEV_ONBOARDING_PREFIX : '/artisan/onboarding';
  return `${base}/${stepId}`;
}
