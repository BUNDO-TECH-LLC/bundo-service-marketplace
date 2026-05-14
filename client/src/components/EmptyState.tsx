export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <article className="empty-state">
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}
