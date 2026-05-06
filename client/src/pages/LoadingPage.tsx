import { FormEvent, useState, useEffect } from 'react';

export default function LoadingPage() {
    const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Simulate loading progress
    const duration = 2800;
    const interval = 30;
    const steps = duration / interval;
    let step = 0;
 
    const timer = setInterval(() => {
      step++;
      // Ease-out curve: fast at start, slows toward end
      const raw = step / steps;
      const eased = 1 - Math.pow(1 - raw, 2.5);
      setProgress(Math.min(eased * 100, 100));
 
      if (step >= steps) {
        clearInterval(timer);
        setTimeout(() => setVisible(false), 400);
      }
    }, interval);
 
    return () => clearInterval(timer);
  }, []);
 
  if (!visible) return null;

  return (
    <div className='bg-[var(--color-page)]'>

    </div>
)

}

