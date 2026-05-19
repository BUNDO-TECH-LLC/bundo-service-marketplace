import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BundoLoadingMark } from '../components/BundoLoadingMark';

type LoadingState = {
  redirectTo?: string;
};

export default function LoadingPage() {
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as LoadingState;
  const redirectTo = state.redirectTo || '/';

  useEffect(() => {
    const duration = 2800;
    const interval = 30;
    const steps = duration / interval;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const raw = step / steps;
      const eased = 1 - Math.pow(1 - raw, 2.5);
      setProgress(Math.min(eased * 100, 100));

      if (step >= steps) {
        clearInterval(timer);
        navigate(redirectTo, { replace: true });
      }
    }, interval);

    return () => clearInterval(timer);
  }, [navigate, redirectTo]);

  return (
    <main className="bundo-loading-page" aria-busy="true" aria-label="Loading Bundo">
      <BundoLoadingMark variant="progress" progress={progress} />
    </main>
  );
}
