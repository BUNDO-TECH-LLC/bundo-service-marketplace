import { ArtisanPortfolioManager } from '../components/ArtisanPortfolioManager';
import type { ActionRunner } from '../appTypes';
import type { PortfolioImage } from '../types';

export function ArtisanOnboardingMediaStep({
  portfolioImages,
  busy,
  uploadingPortfolio,
  runAction,
  uploadPortfolioFile,
  uploadPortfolioFiles,
  removePortfolioImage,
}: {
  portfolioImages: PortfolioImage[];
  busy: boolean;
  uploadingPortfolio: boolean;
  runAction: ActionRunner;
  uploadPortfolioFile: (file: File, displayOrder: number) => Promise<void>;
  uploadPortfolioFiles: (files: File[]) => Promise<void>;
  removePortfolioImage: (imageId: string) => Promise<void>;
}) {
  return (
    <ArtisanPortfolioManager
      variant="onboarding"
      portfolioImages={portfolioImages}
      busy={busy}
      uploadingPortfolio={uploadingPortfolio}
      runAction={runAction}
      uploadPortfolioFile={uploadPortfolioFile}
      uploadPortfolioFiles={uploadPortfolioFiles}
      removePortfolioImage={removePortfolioImage}
    />
  );
}
