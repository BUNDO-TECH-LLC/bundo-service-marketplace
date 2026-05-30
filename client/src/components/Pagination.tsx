export function Pagination({
  page,
  limit,
  total,
  busy,
  onPageChange,
}: {
  page: number;
  limit: number;
  total: number;
  busy?: boolean;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Nothing to page through.
  if (total <= limit) {
    return null;
  }

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <nav className="admin-pagination" aria-label="Pagination">
      <span className="admin-pagination-info">
        {start}–{end} of {total}
      </span>
      <div className="admin-pagination-controls">
        <button
          type="button"
          className="secondary-button"
          disabled={busy || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span className="admin-pagination-page" aria-current="page">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="secondary-button"
          disabled={busy || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
