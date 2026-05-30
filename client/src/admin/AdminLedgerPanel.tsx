import { bookingDate } from '../lib/bookingDisplay';
import { money } from '../lib/formatting';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { useAdminList } from '../hooks/useAdminList';

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

      <ul className="admin-inline-table" role="list">
        {entries.map((entry) => (
          <li className="admin-row admin-row--compact" key={entry.id} role="listitem">
            <div className="admin-row-grid">
              <div className="admin-row-primary">
                <strong className="admin-row-title">
                  {entry.type.replace(/_/g, ' ')} · {money(entry.amount)}
                </strong>
                <p className="admin-row-sub">
                  {entry.booking?.offering?.title || 'Booking'} · #{entry.booking?.id.slice(0, 8)}
                </p>
                {entry.note && <p className="admin-row-note">{entry.note}</p>}
                <span className="muted">{bookingDate(entry.createdAt)}</span>
              </div>
              <dl className="admin-row-fields admin-row-fields--compact">
                <div>
                  <dt>Payment</dt>
                  <dd>{entry.payment?.status || '—'}</dd>
                </div>
                <div>
                  <dt>Reference</dt>
                  <dd>{entry.payment?.paystackReference || '—'}</dd>
                </div>
            </dl>
          </div>
        </li>
        ))}
      </ul>

      <Pagination page={page} limit={limit} total={total} busy={loading} onPageChange={setPage} />
    </section>
  );
}
