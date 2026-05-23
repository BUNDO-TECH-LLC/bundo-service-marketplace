import type { ArtisanLandingProps } from './landing/artisanLandingTypes';
import { ArtisanLandingPhases } from './landing/ArtisanLandingPhases';
import { ArtisanLandingSetupWizard } from './landing/ArtisanLandingSetupWizard';
import { useArtisanLanding } from './landing/useArtisanLanding';

export function ArtisanLanding(props: ArtisanLandingProps) {
  const landing = useArtisanLanding(props);

  if (landing.phase !== 'setup') {
    return <ArtisanLandingPhases landing={landing} />;
  }

  return <ArtisanLandingSetupWizard landing={landing} />;
}
