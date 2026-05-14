export function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <article className="artisan-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}
