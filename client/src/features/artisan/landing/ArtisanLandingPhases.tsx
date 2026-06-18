import { Navigate } from 'react-router-dom';
import { markArtisanApproved } from '../../../lib/artisanApplication';
import { EmptyState } from '../../../components/EmptyState';
import { buildAppPath } from '../../../lib/appPaths';
import { ArtisanPendingApproval } from '../../../views/ArtisanPendingApproval';
import { ArtisanSetupShell } from '../../../views/ArtisanSetupShell';
import type { ArtisanLandingModel } from './artisanLandingTypes';

export function ArtisanLandingPhases({ landing }: { landing: ArtisanLandingModel }) {
  const {
    phase,
    displayName,
    accountEmail,
    profile,
    kycSubmission,
    portfolioImages,
    busy,
    uploadingPortfolio,
    runAction,
    uploadPortfolioFile,
    uploadPortfolioFiles,
    removePortfolioImage,
    openSetupEditor,
    token,
  } = landing;

  if (phase === 'loading') {
    return (
      <ArtisanSetupShell displayName={displayName} email={accountEmail}>
        <main className="artisan-setup-page">
          <EmptyState
            title="Loading your profile"
            body="Checking your verification status and setup progress."
          />
        </main>
      </ArtisanSetupShell>
    );
  }

  if (phase === 'awaiting_approval') {
    return (
      <Navigate to={buildAppPath({ view: 'workspace', workspaceSection: 'overview' })} replace />
    );
  }

  if (phase === 'changes_requested') {
    return (
      <ArtisanSetupShell displayName={displayName} email={accountEmail}>
        <ArtisanPendingApproval
          profile={profile}
          kycSubmission={kycSubmission}
          variant="changes_requested"
          onEditSubmission={openSetupEditor}
          portfolioImages={portfolioImages}
          busy={busy}
          uploadingPortfolio={uploadingPortfolio}
          runAction={runAction}
          uploadPortfolioFile={uploadPortfolioFile}
          uploadPortfolioFiles={uploadPortfolioFiles}
          removePortfolioImage={removePortfolioImage}
          token={token}
        />
      </ArtisanSetupShell>
    );
  }

  if (phase === 'rejected') {
    return (
      <ArtisanSetupShell displayName={displayName} email={accountEmail}>
        <ArtisanPendingApproval
          profile={profile}
          kycSubmission={kycSubmission}
          variant="rejected"
          onEditSubmission={openSetupEditor}
          portfolioImages={portfolioImages}
          busy={busy}
          uploadingPortfolio={uploadingPortfolio}
          runAction={runAction}
          uploadPortfolioFile={uploadPortfolioFile}
          uploadPortfolioFiles={uploadPortfolioFiles}
          removePortfolioImage={removePortfolioImage}
          token={token}
        />
      </ArtisanSetupShell>
    );
  }

  if (phase === 'approved') {
    markArtisanApproved(profile?.userId);
    return (
      <Navigate to={buildAppPath({ view: 'workspace', workspaceSection: 'overview' })} replace />
    );
  }

  return null;
}
