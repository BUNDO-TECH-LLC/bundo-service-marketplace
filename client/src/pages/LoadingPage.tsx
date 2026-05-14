import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import bundoLogo from "../assets/BundoLogo.png";


type LoadingState = {
  redirectTo?: string;
};


export default function LoadingPage() {
  const [progress, setProgress] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();

  const state = (location.state || {}) as LoadingState;

  const redirectTo = state.redirectTo || "/";

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
    <main className="min-h-screen w-full bg-[var(--color-page)] flex items-center justify-center">
      <section className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-0">
          <div className="h-[50px] w-[50px] rounded-[8px] flex items-center justify-center">
            <img
              src={bundoLogo}
              alt="Bundo logo"
              className="h-[34px] w-[34px] object-contain"
            />
          </div>

          <h1 className="text-[36px] font-bold leading-none text-[var(--color-solid)]">
            Bundo
          </h1>
        </div>

        <div className="h-[9px] w-[178px] rounded-md border border-[var(--color-primary)] overflow-hidden bg-transparent">
          <div
            className="h-full rounded-md bg-[var(--color-primary)] transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>
    </main>
  );
}