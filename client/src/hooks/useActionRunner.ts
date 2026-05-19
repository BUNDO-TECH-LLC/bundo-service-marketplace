import { useCallback, useState } from 'react';
import { ApiError } from '../lib/api';
import type { ActionRunner } from '../appTypes';

export function useActionRunner() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const withNotice: ActionRunner = useCallback(async (action, done = 'Done') => {
    setBusy(true);
    setNotice('');
    try {
      await action();
      if (done) {
        setNotice(done);
      }
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error && error.message.trim()
            ? error.message
            : 'Something went wrong';
      setNotice(message);
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, notice, setNotice, withNotice };
}
