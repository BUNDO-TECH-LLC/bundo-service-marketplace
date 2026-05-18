import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { MainLayout } from './MainLayout';

const HomePage = lazy(() => import('../pages/HomePage'));
const MarketplacePage = lazy(() => import('../pages/MarketplacePage'));
const WorkspacePage = lazy(() => import('../pages/WorkspacePage'));
const AdminPage = lazy(() => import('../pages/AdminPage'));
const HelpPage = lazy(() => import('../pages/HelpPage'));
const ArtisanProfileRoute = lazy(() => import('../pages/ArtisanProfileRoute'));

function PageFallback() {
  return (
    <main className="page route-loading">
      <EmptyState title="Loading page" body="Preparing this section of the app." />
    </main>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="marketplace" element={<MarketplacePage />} />
          <Route path="workspace" element={<Outlet />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path=":section" element={<WorkspacePage />} />
          </Route>
          <Route path="admin" element={<Outlet />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path=":section" element={<AdminPage />} />
          </Route>
          <Route path="help" element={<Outlet />}>
            <Route index element={<HelpPage />} />
            <Route path=":topicId" element={<HelpPage />} />
          </Route>
          <Route path="artisans/:artisanId" element={<ArtisanProfileRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
