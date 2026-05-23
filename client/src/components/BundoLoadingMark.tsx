import bundoLogo from '../assets/bundo-logo.png';

type BundoLoadingMarkProps = {
  variant?: 'indeterminate' | 'progress';
  progress?: number;
};

export function BundoLoadingMark({ variant = 'indeterminate', progress = 0 }: BundoLoadingMarkProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={`bundo-loading-mark bundo-loading-mark--${variant}`}>
      <div className="bundo-loading-mark-brand">
        <img className="bundo-loading-logo" src={bundoLogo} alt="" />
        <span className="bundo-loading-wordmark">Bundo</span>
      </div>

      {variant === 'progress' ? (
        <div
          className="bundo-loading-bar bundo-loading-bar--progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(clampedProgress)}
        >
          <span
            className="bundo-loading-bar-fill bundo-loading-bar-fill--progress"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      ) : (
        <div className="bundo-loading-bar" aria-hidden="true">
          <span className="bundo-loading-bar-fill" />
        </div>
      )}
    </div>
  );
}
