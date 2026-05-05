import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from "../pages/LandingPage";
import { AuthPage } from '../pages/auth/AuthPage';
import { EmailVerificationPage } from '../pages/auth/EmailVerificationPage';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/create-account" element={<AuthPage mode="signup" />} />
      <Route path="/verify-email" element={<EmailVerificationPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
