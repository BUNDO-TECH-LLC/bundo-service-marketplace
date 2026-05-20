export function OnboardingDevBanner() {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
    >
      <strong className="font-bold">Dev preview</strong> — auth and onboarding progress checks are skipped.
      Form submit advances locally; API saves only when you are signed in as an artisan.
    </div>
  );
}
