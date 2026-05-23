import { Link } from 'react-router-dom';
import bundoLogo from '../../assets/BundoLogo.png';
import { appRoutes } from '../../routes/paths';

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-[var(--color-paper)]/95 px-6 py-4 backdrop-blur lg:px-[7vw] xl:px-28">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link className="inline-flex items-center gap-3 text-[var(--color-ink)] no-underline" to={appRoutes.home}>
          <img className="h-12 w-12 rounded-xl object-cover" src={bundoLogo} alt="Bundo logo" />
          <span className="text-3xl font-black">Bundo</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-semibold text-[var(--color-ink)] md:flex">
          <Link className="no-underline hover:text-[var(--color-accent-bright)]" to={appRoutes.categories}>
            Marketplace
          </Link>
          <Link className="no-underline hover:text-[var(--color-accent-bright)]" to={appRoutes.help}>
            Help
          </Link>
          <Link className="no-underline hover:text-[var(--color-accent-bright)]" to={appRoutes.login}>
            Log in
          </Link>
        </nav>

        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-accent-button)] px-5 text-sm font-semibold text-[var(--color-paper)] no-underline hover:bg-[var(--color-primary-hover)]"
          to={appRoutes.signup}
        >
          Create account
        </Link>
      </div>
    </header>
  );
}
