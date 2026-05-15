import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import LandingPage from '../pages/customer/LandingPage/LandingPage';
import CategoriesPage from '../pages/CategoriesPage';
import HelpPage from '../pages/HelpPage';
import { AuthPage } from '../pages/auth/AuthPage';
import { EmailVerificationPage } from '../pages/auth/EmailVerificationPage';
import CustomerDashboard from '../pages/customer/Dashboard';
import CustomerWorkspacePage from '../pages/customer/Workspace';
import ArtisanDashboardPage from '../pages/artisan/Dashboard';
import ProfilePage from '../pages/artisan/ProfilePage';
import AdminPage from '../pages/admin/AdminPage';
import LoadingPage from '../pages/LoadingPage';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route element={<AppLayout />}>
        <Route path="/dev/verify-email" element={<EmailVerificationPage />} />
        <Route path="/dev/login" element={<AuthPage mode="login" />} />
        <Route path="/dev/signup" element={<AuthPage mode="signup" />} />
        <Route path="/dev/loading" element={<LoadingPage />} />
        <Route path="/dev/customer-dashboard" element={<CustomerDashboard requireAuth={false} />} />
        <Route path="/dev/customer/dashboard" element={<CustomerDashboard requireAuth={false} />} />
        <Route path="/dev/marketplace" element={<Navigate to="/categories" replace />} />
        <Route path="dev/categories" element={<CategoriesPage />} />

        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/marketplace" element={<Navigate to="/categories" replace />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/create-account" element={<AuthPage mode="signup" />} />
        <Route path="/verify-email" element={<EmailVerificationPage />} />
        <Route path="/customer/workspace" element={<CustomerWorkspacePage />} />
        <Route path="/customer/dashboard" element={<CustomerDashboard />} />
        <Route path="/artisan/dashboard" element={<ArtisanDashboardPage />} />
        <Route path="/artisans/:artisanId" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/loading" element={<LoadingPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
