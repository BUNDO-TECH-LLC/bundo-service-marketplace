import { AppError } from './errors';

type StatusHandler = AppError | (() => AppError);

/** Throw a typed HTTP error when `status` matches a known service result key. */
export function throwOnServiceStatus(
  status: string,
  handlers: Record<string, StatusHandler>
): void {
  const handler = handlers[status];
  if (!handler) {
    return;
  }

  throw typeof handler === 'function' ? handler() : handler;
}
