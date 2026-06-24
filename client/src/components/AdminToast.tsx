import { useEffect } from 'react';

export function AdminToast({
  message,
  onDismiss,
  durationMs = 3600,
}: {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  return (
    <div className="admin-toast" role="status" aria-live="polite">
      <p>{message}</p>
      <button type="button" className="admin-toast-dismiss" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
