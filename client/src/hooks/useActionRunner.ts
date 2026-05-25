import { useCallback, useState } from 'react';
import { ApiError } from '../lib/api';
import type { ActionRunner } from '../appTypes';

const LOW_SIGNAL_NOTICES = new Set([
  'Done',
  'Signed in',
  'Signed out',
  'Opening marketplace',
  'Category selected',
  'Showing available services',
]);

function shouldSuppressNotice(message: string) {
  const normalized = message.trim();
  return LOW_SIGNAL_NOTICES.has(normalized) || normalized.startsWith('Searching for ');
}

export function useActionRunner() {
  const [busy, setBusy] = useState(false);
  const [notice, setNoticeState] = useState('');

  const setNotice = useCallback((message: string) => {
    const normalized = message.trim();

    if (!normalized) {
      setNoticeState('');
      return;
    }

    if (shouldSuppressNotice(normalized)) {
      return;
    }

    setNoticeState(normalized);
  }, []);

  const withNotice: ActionRunner = useCallback(async (action, done = 'Done') => {
    setBusy(true);
    setNoticeState('');
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
  }, [setNotice]);

  return { busy, notice, setNotice, withNotice };
}
