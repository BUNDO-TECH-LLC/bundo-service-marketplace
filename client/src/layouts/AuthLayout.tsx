import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import bundoLogo from '../assets/BundoLogo.png';
import LandingPage from '../pages/LandingPage';

type AuthLayoutProps = {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
};

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  const navigate = useNavigate();

  return (
    <main className="relative min-h-screen bg-[var(--color-page)]">
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden select-none [&>.app-shell]:min-h-screen [&>.app-shell]:scale-[1.004] [&>.app-shell]:blur-[1.5px]"
        aria-hidden="true"
      >
        <LandingPage />
      </div>

      <section
        className="fixed inset-0 z-[90] grid place-items-center overflow-auto bg-[var(--overlay-page)] p-5"
        aria-labelledby="auth-page-title"
        onClick={() => navigate('/')}
      >
        <div
          className="grid w-full max-w-[440px] gap-4 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-white)] p-4 shadow-[0_24px_80px_var(--shadow-modal)]"
          role="dialog"
        aria-modal="true"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="grid gap-6">
            <span
              className="grid h-[40px] w-[40px] place-items-center justify-self-center rounded-lg"
              aria-hidden="true"
            >
              <img className="h-[34px] w-[34px] rounded-[5px] object-cover" src={bundoLogo} alt="Bundo logo" />
            </span>

            <div className="grid gap-2 justify-items-center text-center">
              <h2
                id="auth-page-title"
                className="m-0 text-[25px] leading-tight font-medium text-[var(--color-ink-muted)]"
              >
                {title}
              </h2>

              <p className="m-0 text-base text-[var(--color-text-sub)]">
                {subtitle}
              </p>
            </div>
          </div>
          <div className="m-0">{children}</div>
        </div>
      </section>
    </main>
  );
}
