import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import bundoLogo from '../../../assets/BundoLogo.png';
import { auth } from '../../../lib/firebase';
import { resolveApiSession } from '../../../lib/authSession';
import {
  fetchOnboardingStatus,
  getFirstIncompleteStepPath,
  isOnboardingComplete,
  type OnboardingStatus,
} from '../../../lib/artisanOnboarding';
import { appRoutes } from '../../../routes/paths';
import { OnboardingStepper } from './OnboardingStepper';
import { OnboardingDevBanner } from './OnboardingDevBanner';
import { getOnboardingStepByPath, type OnboardingStepMeta } from './onboardingPaths';
import { isDevOnboardingPreview } from './onboardingPreview';

function isStepAheadOfProgress(stepId: OnboardingStepMeta['id'], status: OnboardingStatus) {
  if (stepId === 'pricing') {
    return !status.hasProfile;
  }

  if (stepId === 'portfolio') {
    return !status.hasProfile || !status.hasOfferings;
  }

  if (stepId === 'availability') {
    return !status.hasProfile || !status.hasOfferings || !status.hasPortfolio;
  }

  return false;
}

type ArtisanOnboardingLayoutProps = {
  requireAuth?: boolean;
};

export function ArtisanOnboardingLayout({ requireAuth = true }: ArtisanOnboardingLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const activeStep = getOnboardingStepByPath(location.pathname);
  const devPreview = !requireAuth || isDevOnboardingPreview(location.pathname);

  useEffect(() => {
    if (devPreview) {
      setReady(true);
      return undefined;
    }

    if (!auth) {
      navigate(appRoutes.login, { replace: true });
      return undefined;
    }

    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate(appRoutes.login, { replace: true });
        return;
      }

      if (!user.emailVerified) {
        navigate(appRoutes.verifyEmail, { replace: true });
        return;
      }

      try {
        const session = await resolveApiSession(user);

        if (session.user.role === 'ADMIN') {
          navigate(appRoutes.admin, { replace: true });
          return;
        }

        if (session.user.role !== 'ARTISAN') {
          navigate(appRoutes.customerDashboard, { replace: true });
          return;
        }

        const status = await fetchOnboardingStatus(session.token);

        if (isOnboardingComplete(status)) {
          navigate(appRoutes.artisanDashboard, { replace: true });
          return;
        }

        const allowedPath = getFirstIncompleteStepPath(status);

        if (isStepAheadOfProgress(activeStep.id, status) && location.pathname !== allowedPath) {
          navigate(allowedPath, { replace: true });
          return;
        }

        setReady(true);
      } catch {
        navigate(appRoutes.login, { replace: true });
      }
    });
  }, [activeStep.id, devPreview, location.pathname, navigate]);

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--color-page)] text-sm text-[var(--color-text-muted)]">
        Loading…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-page)]">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link to={appRoutes.home} className="inline-flex items-center gap-2 no-underline">
            <img className="h-9 w-9 rounded-md object-cover" src={bundoLogo} alt="Bundo" />
            <span className="text-xl font-extrabold tracking-tight text-[var(--color-ink)]">Bundo</span>
          </Link>

          <p className="m-0 text-sm text-[var(--color-text-muted)]">
            Already have an account?{' '}
            <Link
              className="font-bold text-[var(--color-accent-bright)] no-underline hover:text-[var(--color-accent-dark)]"
              to={appRoutes.login}
            >
              Log in
            </Link>
          </p>
        </header>

        {devPreview ? <OnboardingDevBanner /> : null}

        <div className="grid gap-6">
          <OnboardingStepHeader activeStep={activeStep} />
        </div>

        <Outlet />
      </div>
    </main>
  );
}

function OnboardingStepHeader({ activeStep }: { activeStep: OnboardingStepMeta }) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 max-w-[420px] text-2xl font-semibold leading-tight text-[var(--color-ink-muted)] sm:text-[28px]">
          {activeStep.title}
        </h1>
        <p className="m-0 text-sm font-bold text-[var(--color-accent-bright)]">
          Step {activeStep.step} of 4
        </p>
      </div>

      <OnboardingStepper currentStep={activeStep.step} />
    </>
  );
}
