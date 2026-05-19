import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { BundoLoadingScreen } from '../components/BundoLoadingScreen';
import { MainLayout } from './MainLayout';

const HomePage = lazy(() => import('../pages/HomePage'));
const MarketplacePage = lazy(() => import('../pages/MarketplacePage'));
const WorkspacePage = lazy(() => import('../pages/WorkspacePage'));
const AdminPage = lazy(() => import('../pages/AdminPage'));
const HelpPage = lazy(() => import('../pages/HelpPage'));
const ArtisanProfileRoute = lazy(() => import('../pages/ArtisanProfileRoute'));
const AuthPage = lazy(() =>
  import('../pages/auth/AuthPage').then((module) => ({ default: module.AuthPage }))
);
const EmailVerificationPage = lazy(() =>
  import('../pages/auth/EmailVerificationPage').then((module) => ({
    default: module.EmailVerificationPage,
  }))
);
const LoadingPage = lazy(() => import('../pages/LoadingPage'));

function PageFallback() {
  return <BundoLoadingScreen />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/create-account" element={<Navigate to="/signup" replace />} />
        <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
        <Route path="/verify-email" element={<EmailVerificationPage />} />
        <Route path="/loading" element={<LoadingPage />} />

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
