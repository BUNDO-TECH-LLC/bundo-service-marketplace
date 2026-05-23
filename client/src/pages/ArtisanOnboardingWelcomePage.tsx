import { Navigate } from 'react-router-dom';
import { ARTISAN_ONBOARDING_PATH } from '../lib/artisanApplication';

/** Legacy URL — artisans go straight to onboarding. */
export default function ArtisanOnboardingWelcomePage() {
  return <Navigate to={ARTISAN_ONBOARDING_PATH} replace />;
}
