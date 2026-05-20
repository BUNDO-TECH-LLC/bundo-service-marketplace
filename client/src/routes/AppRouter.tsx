import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import LandingPage from '../pages/customer/LandingPage/LandingPage';
import CategoriesPage from '../pages/CategoriesPage';
import HelpPage from '../pages/HelpPage';
import { AuthPage } from '../pages/auth/AuthPage';
import { EmailVerificationPage } from '../pages/auth/EmailVerificationPage';
import CustomerDashboard from '../pages/customer/Dashboard';
import CustomerWorkspacePage from '../pages/customer/Workspace';
import MessagesPage from '../pages/customer/MessagesPage';
import BookJobPage from '../pages/customer/BookJobPage';
import ArtisanDashboardPage from '../pages/artisan/Dashboard';
import { ArtisanOnboardingLayout } from '../pages/artisan/onboarding/ArtisanOnboardingLayout';
import { BasicInfoStep } from '../pages/artisan/onboarding/BasicInfoStep';
import { AvailabilityStep } from '../pages/artisan/onboarding/AvailabilityStep';
import { PortfolioStep } from '../pages/artisan/onboarding/PortfolioStep';
import { PricingStep } from '../pages/artisan/onboarding/PricingStep';
import ProfilePage from '../pages/customer/artisan-profile/ProfilePage';
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
        <Route path="/dev/artisan/dashboard" element={<ArtisanDashboardPage requireAuth={false} />} />
        <Route path="/dev/artisan/onboarding" element={<ArtisanOnboardingLayout requireAuth={false} />}>
          <Route index element={<Navigate to="basic-info" replace />} />
          <Route path="basic-info" element={<BasicInfoStep />} />
          <Route path="pricing" element={<PricingStep />} />
          <Route path="portfolio" element={<PortfolioStep />} />
          <Route path="availability" element={<AvailabilityStep />} />
        </Route>
        <Route path="/dev/marketplace" element={<Navigate to="/categories" replace />} />
        <Route path="dev/categories" element={<CategoriesPage />} />

        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/marketplace" element={<Navigate to="/categories" replace />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/create-account" element={<AuthPage mode="signup" />} />
        <Route path="/verify-email" element={<EmailVerificationPage />} />
        <Route path="/customer/messages" element={<MessagesPage />} />
        <Route path="/customer/workspace" element={<CustomerWorkspacePage />} />
        <Route path="/customer/book" element={<BookJobPage />} />
        <Route path="/customer/dashboard" element={<CustomerDashboard />} />
        <Route path="/artisan/onboarding" element={<ArtisanOnboardingLayout />}>
          <Route index element={<Navigate to="basic-info" replace />} />
          <Route path="basic-info" element={<BasicInfoStep />} />
          <Route path="pricing" element={<PricingStep />} />
          <Route path="portfolio" element={<PortfolioStep />} />
          <Route path="availability" element={<AvailabilityStep />} />
        </Route>
        <Route path="/artisan/dashboard" element={<ArtisanDashboardPage />} />
        <Route path="/artisans/:artisanId" element={<ProfilePage/>} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/loading" element={<LoadingPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
