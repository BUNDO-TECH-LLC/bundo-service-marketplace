import { Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <div className="app-layout min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)]">
      <Outlet />
    </div>
  );
}
