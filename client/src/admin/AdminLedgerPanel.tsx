import { bookingDate } from '../lib/bookingDisplay';
import { money } from '../lib/formatting';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { useAdminList } from '../hooks/useAdminList';
import { AdminTableScrollHint } from './AdminTableScrollHint';

type LedgerEntryRow = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  note: string | null;
  createdAt: string;
  booking?: { id: string; offering?: { title?: string } };
  payment?: { status?: string; paystackReference?: string | null };
};

export function AdminLedgerPanel({ token }: { token: string }) {
  const {
    items: entries,
    total,
    page,
    limit,
    loading,
    setPage,
  } = useAdminList<LedgerEntryRow>({
    token,
    path: '/admin/ledger-entries',
    limit: 25,
    select: (response) => (response.entries as LedgerEntryRow[]) ?? [],
  });

  return (
    <section className="admin-panel admin-ledger-panel">
      <p className="admin-panel-lead muted">Recent ledger movements for payouts, fees, and refunds.</p>

      {loading && <p className="muted">Loading ledger…</p>}
      {!loading && entries.length === 0 && (
        <EmptyState title="No ledger entries" body="Payment activity will appear here once bookings are paid." />
      )}

      {entries.length > 0 && (
        <div className="admin-table-scroll-wrap">
          <AdminTableScrollHint />
          <table className="admin-ledger-table admin-data-table">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Amount</th>
                <th scope="col">Booking</th>
                <th scope="col">Note</th>
                <th scope="col">Date</th>
                <th scope="col">Payment</th>
                <th scope="col">Reference</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.type.replace(/_/g, ' ')}</td>
                  <td className="admin-data-table-nowrap">
                    <strong>{money(entry.amount)}</strong>
                  </td>
                  <td className="admin-data-table-clip">
                    {entry.booking?.offering?.title || 'Booking'} · #{entry.booking?.id.slice(0, 8)}
                  </td>
                  <td className="admin-data-table-clip" title={entry.note || undefined}>
                    {entry.note || '—'}
                  </td>
                  <td className="admin-data-table-nowrap">{bookingDate(entry.createdAt)}</td>
                  <td>{entry.payment?.status || '—'}</td>
                  <td className="admin-data-table-clip">{entry.payment?.paystackReference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} limit={limit} total={total} busy={loading} onPageChange={setPage} />
    </section>
  );
}
