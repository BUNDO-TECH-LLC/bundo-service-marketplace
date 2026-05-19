import { signOut } from 'firebase/auth';
import { AdminConsole } from '../admin/AdminConsole';
import { auth } from '../lib/firebase';
import { useAppRoot } from '../app/appRootContext';
import { buildAppPath } from '../lib/appPaths';

export default function AdminPage() {
  const ctx = useAppRoot();

  return (
    <main className="admin-page">
      <AdminConsole
        section={ctx.adminSection}
        setSection={(section) => ctx.navigate(buildAppPath({ view: 'admin', adminSection: section }))}
        stats={ctx.adminStats}
        users={ctx.adminUsers}
        artisans={ctx.adminArtisans}
        bookings={ctx.adminBookings}
        bookingsTotal={ctx.adminBookingsTotal}
        conversations={ctx.adminConversations}
        submissions={ctx.adminKycSubmissions}
        categories={ctx.adminCategories}
        token={ctx.token}
        adminLabel={ctx.firebaseUser?.email || ctx.me?.email || 'Admin'}
        busy={ctx.busy}
        runAction={ctx.withNotice}
        refresh={() => ctx.loadPrivateData()}
        onSignOut={() => {
          ctx.setNotice('Signed out');
          auth && signOut(auth);
        }}
      />
    </main>
  );
}
