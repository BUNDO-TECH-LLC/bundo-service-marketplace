import { EmptyState } from '../components/EmptyState';
import { ArtisanProfilePage } from '../views/ArtisanProfilePage';
import { useAppRoot } from '../app/appRootContext';

export default function ArtisanProfileRoute() {
  const ctx = useAppRoot();

  if (ctx.selectedArtisan) {
    return (
      <ArtisanProfilePage
        artisan={ctx.selectedArtisan}
        reviews={ctx.selectedArtisanReviews}
        isAuthed={ctx.isAuthed}
        role={ctx.me?.role || null}
        token={ctx.token}
        busy={ctx.busy}
        runAction={ctx.withNotice}
        onBack={() => ctx.navigate('/marketplace')}
        reloadPrivate={() => ctx.loadPrivateData()}
        onBookingSuccess={ctx.setBookingSuccess}
      />
    );
  }

  return (
    <main className="page route-loading">
      <EmptyState title="Loading artisan profile" body="Fetching profile details." />
    </main>
  );
}
