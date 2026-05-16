import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { AdminConsole } from '../../admin/AdminConsole';
import type {
  ActionRunner,
  AdminArtisanRecord,
  AdminCategoryRecord,
  AdminSection,
  AdminUserRecord,
} from '../../appTypes';
import { auth } from '../../lib/firebase';
import { resolveApiSession } from '../../lib/authSession';
import { api } from '../../lib/api';
import type { ArtisanKycSubmission, Booking, Conversation } from '../../types';
import { appRoutes } from '../../routes/paths';

export default function AdminPage() {
  const navigate = useNavigate();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [section, setSection] = useState<AdminSection>('overview');
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [artisans, setArtisans] = useState<AdminArtisanRecord[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [submissions, setSubmissions] = useState<ArtisanKycSubmission[]>([]);
  const [categories, setCategories] = useState<AdminCategoryRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!auth) {
      navigate(appRoutes.login, { replace: true });
      return undefined;
    }

    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        navigate(appRoutes.login, { replace: true });
        return;
      }

      try {
        const session = await resolveApiSession(user);

        if (session.user.role !== 'ADMIN') {
          navigate(appRoutes.customerDashboard, { replace: true });
          return;
        }

        setToken(session.token);
      } catch {
        navigate(appRoutes.login, { replace: true });
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (!token) {
      return;
    }

    void refresh();
  }, [token]);

  const runAction: ActionRunner = async (action, done = 'Done') => {
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
  };

  async function refresh() {
    if (!token) {
      return;
    }

    setBusy(true);
    setNotice('');

    try {
      const [
        statsResponse,
        userResponse,
        artisanResponse,
        bookingResponse,
        conversationResponse,
        submissionResponse,
        categoryResponse,
      ] = await Promise.all([
        api<{ stats: Record<string, number> }>('/admin/stats', { token }),
        api<{ users: AdminUserRecord[] }>('/admin/users?page=1&limit=50', { token }),
        api<{ artisans: AdminArtisanRecord[] }>('/admin/artisans?page=1&limit=50', { token }),
        api<{ bookings: Booking[] }>('/admin/bookings?page=1&limit=20', { token }),
        api<{ conversations: Conversation[] }>('/admin/conversations?page=1&limit=20', { token }),
        api<{ submissions: ArtisanKycSubmission[] }>('/admin/kyc-submissions?page=1&limit=20', { token }),
        api<{ categories: AdminCategoryRecord[] }>('/admin/categories?page=1&limit=50', { token }),
      ]);

      setStats(statsResponse.stats);
      setUsers(userResponse.users);
      setArtisans(artisanResponse.artisans);
      setBookings(bookingResponse.bookings);
      setConversations(conversationResponse.conversations);
      setSubmissions(submissionResponse.submissions);
      setCategories(categoryResponse.categories);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load admin data.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (auth) {
      await signOut(auth);
    }

    navigate(appRoutes.home, { replace: true });
  }

  return (
    <div className="app-screen-gutter min-h-screen bg-[var(--color-paper)] py-8">
      {notice ? <div className="notice mb-5">{notice}</div> : null}
      <AdminConsole
        section={section}
        setSection={setSection}
        stats={stats}
        users={users}
        artisans={artisans}
        bookings={bookings}
        conversations={conversations}
        submissions={submissions}
        categories={categories}
        token={token}
        adminLabel={firebaseUser?.email || 'admin'}
        busy={busy}
        runAction={runAction}
        refresh={refresh}
        onSignOut={() => void logout()}
      />
    </div>
  );
}
