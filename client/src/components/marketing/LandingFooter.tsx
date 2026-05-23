import { Link } from 'react-router-dom';
import bundoLogo from '../../assets/BundoLogo.png';
import { appRoutes } from '../../routes/paths';

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--color-line)] px-6 py-10 lg:px-[7vw] xl:px-28">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <div className="inline-flex items-center gap-3">
            <img className="h-11 w-11 rounded-xl object-cover" src={bundoLogo} alt="Bundo logo" />
            <span className="text-2xl font-black text-[var(--color-ink)]">Bundo</span>
          </div>
          <p className="mt-3 max-w-[520px] text-sm leading-7 text-[var(--color-text-sub)]">
            Customer, artisan, and admin experiences are now being split into dedicated screens so each workflow can evolve independently.
          </p>
        </div>

        <nav className="flex flex-wrap gap-5 text-sm font-semibold">
          <Link className="text-[var(--color-accent-bright)] no-underline" to={appRoutes.categories}>
            Marketplace
          </Link>
          <Link className="text-[var(--color-accent-bright)] no-underline" to={appRoutes.help}>
            Help
          </Link>
          <Link className="text-[var(--color-accent-bright)] no-underline" to={appRoutes.login}>
            Log in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
