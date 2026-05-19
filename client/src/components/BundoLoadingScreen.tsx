import { BundoLoadingMark } from './BundoLoadingMark';

export function BundoLoadingScreen() {
  return (
    <div className="bundo-loading-screen" role="status" aria-live="polite" aria-label="Loading Bundo">
      <BundoLoadingMark variant="indeterminate" />
    </div>
  );
}
