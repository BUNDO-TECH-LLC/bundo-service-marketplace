import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useNavigate, useParams } from 'react-router-dom';
import { ArtisanProfilePage } from '../../views/ArtisanProfilePage';
import { api } from '../../lib/api';
import { auth } from '../../lib/firebase';
import { resolveApiSession } from '../../lib/authSession';
import type { BookingSuccessState } from '../../appTypes';
import type { ApiUser, Artisan, Review } from '../../types';
import { appRoutes, buildCustomerWorkspacePath } from '../../routes/paths';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { artisanId = '' } = useParams();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [me, setMe] = useState<ApiUser | null>(null);
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!auth) {
      return undefined;
    }

    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        setToken('');
        setMe(null);
        return;
      }

      try {
        const session = await resolveApiSession(user);
        setToken(session.token);
        setMe(session.user);
      } catch {
        setToken('');
        setMe(null);
      }
    });
  }, []);

  useEffect(() => {
    if (!artisanId) {
      navigate(appRoutes.categories, { replace: true });
      return;
    }

    setBusy(true);
    setNotice('');

    Promise.all([
      api<{ artisan: Artisan }>(`/artisans/${artisanId}`),
      api<{ reviews: Review[] }>(`/artisans/${artisanId}/reviews`),
    ])
      .then(([artisanResponse, reviewResponse]) => {
        setArtisan(artisanResponse.artisan);
        setReviews(reviewResponse.reviews);
      })
      .catch(() => {
        setNotice('Could not load this artisan profile right now.');
      })
      .finally(() => {
        setBusy(false);
      });
  }, [artisanId, navigate]);

  async function reloadPrivate() {
    return Promise.resolve();
  }

  async function runAction(action: () => Promise<void>, done = 'Done') {
    setBusy(true);
    setNotice('');

    try {
      await action();
      if (done) {
        setNotice(done);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  function handleBookingSuccess(booking: BookingSuccessState) {
    setNotice(`Booking requested for ${booking.serviceTitle} with ${booking.artisanName}.`);

    if (me?.role === 'CUSTOMER') {
      navigate(buildCustomerWorkspacePath('bookings'));
    }
  }

  if (!artisan) {
    return (
      <main className="app-screen-gutter py-10">
        {notice ? <div className="notice mb-4">{notice}</div> : null}
        <button className="secondary-button" type="button" onClick={() => navigate(appRoutes.categories)}>
          Back to marketplace
        </button>
      </main>
    );
  }

  return (
    <div>
      {notice ? <div className="notice app-screen-notice my-6">{notice}</div> : null}
      <ArtisanProfilePage
        artisan={artisan}
        reviews={reviews}
        isAuthed={Boolean(firebaseUser && token)}
        role={me?.role || null}
        token={token}
        busy={busy}
        runAction={runAction}
        onBack={() => navigate(appRoutes.categories)}
        reloadPrivate={reloadPrivate}
        onBookingSuccess={handleBookingSuccess}
      />
    </div>
  );
}
