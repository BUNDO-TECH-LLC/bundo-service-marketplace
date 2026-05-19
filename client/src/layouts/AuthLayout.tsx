import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import bundoLogo from '../assets/BundoLogo.png';
import { AuthMarketingBackdrop } from '../components/AuthMarketingBackdrop';

type AuthLayoutProps = {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
};

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="relative min-h-screen bg-[var(--color-page)]">
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none [&_.auth-marketing-backdrop]:min-h-screen"
        aria-hidden="true"
      >
        <AuthMarketingBackdrop />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-5">
        <div className="grid w-full max-w-[440px] gap-4 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-white)] p-4 shadow-[0_24px_80px_var(--shadow-modal)]">
          <div className="grid gap-6">
            <Link
              className="grid h-[40px] w-[40px] place-items-center justify-self-center rounded-lg no-underline"
              to="/"
              aria-label="Back to home"
            >
              <img className="h-[34px] w-[34px] rounded-[5px] object-cover" src={bundoLogo} alt="Bundo logo" />
            </Link>

            <div className="grid gap-2 justify-items-center text-center">
              <h1 className="m-0 text-[25px] leading-tight font-medium text-[var(--color-ink-muted)]">{title}</h1>
              <p className="m-0 text-base text-[var(--color-text-sub)]">{subtitle}</p>
            </div>
          </div>

          <div className="m-0">{children}</div>
        </div>
      </div>
    </main>
  );
}
