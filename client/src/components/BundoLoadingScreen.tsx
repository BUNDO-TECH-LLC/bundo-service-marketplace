import bundoLogo from '../assets/bundo-logo.png';

export function BundoLoadingScreen() {
  return (
    <div className="bundo-loading-screen" role="status" aria-live="polite" aria-label="Loading Bundo">
      <div className="bundo-loading-screen-inner">
        <img className="bundo-loading-logo" src={bundoLogo} alt="" />
        <span className="bundo-loading-wordmark">Bundo</span>
        <div className="bundo-loading-bar" aria-hidden="true">
          <span className="bundo-loading-bar-fill" />
        </div>
      </div>
    </div>
  );
}
