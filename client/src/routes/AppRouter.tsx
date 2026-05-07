import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from "../pages/LandingPage";
import { AuthPage } from '../pages/auth/AuthPage';
import { EmailVerificationPage } from '../pages/auth/EmailVerificationPage';
import LoadingPage from '../pages/LoadingPage';


export default function AppRouter() {
  return (
    <Routes>
      // dev routes for testing pages without going through the full flow
      <Route path="/dev/verify-email" element={<EmailVerificationPage />} />
      <Route path="/dev/login" element={<AuthPage mode="login" />} />
      <Route path="/dev/signup" element={<AuthPage mode="signup" />} />
      <Route path="/dev/loading" element={<LoadingPage />} />

      // main routes
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/create-account" element={<AuthPage mode="signup" />} />
      <Route path="/verify-email" element={<EmailVerificationPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      <Route path="/loading" element={<LoadingPage />} />
    </Routes>
  );
}
