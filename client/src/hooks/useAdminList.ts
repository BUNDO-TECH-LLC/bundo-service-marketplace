import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export type AdminListResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  loading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
};

/**
 * Self-fetching, server-paginated list for admin panels. Reads `meta.total`
 * from the standard admin list response shape and exposes page controls.
 */
export function useAdminList<T>(options: {
  token: string;
  path: string;
  select: (response: { meta?: { total?: number } } & Record<string, unknown>) => T[];
  limit?: number;
  extraParams?: Record<string, string>;
  enabled?: boolean;
}): AdminListResult<T> {
  const { token, path, limit = 20, enabled = true } = options;
  const extraKey = options.extraParams ? JSON.stringify(options.extraParams) : '';

  // Keep latest select/extraParams in refs so they don't churn the fetch callback.
  const selectRef = useRef(options.select);
  selectRef.current = options.select;
  const extraParamsRef = useRef(options.extraParams);
  extraParamsRef.current = options.extraParams;

  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (targetPage: number) => {
      if (!enabled) {
        setLoading(false);
        setItems([]);
        setTotal(0);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: String(limit),
          ...(extraParamsRef.current ?? {}),
        });
        const response = await api<{ meta?: { total?: number } } & Record<string, unknown>>(
          `${path}?${params.toString()}`,
          { token }
        );
        const list = selectRef.current(response);
        setItems(list);
        setTotal(response.meta?.total ?? list.length);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load this list.');
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [token, path, limit, enabled]
  );

  // Reset to the first page whenever filters (extra params) change.
  useEffect(() => {
    setPage(1);
  }, [extraKey]);

  useEffect(() => {
    void fetchPage(page);
  }, [page, fetchPage, extraKey, enabled]);

  const reload = useCallback(() => fetchPage(page), [fetchPage, page]);

  return { items, total, page, limit, loading, error, setPage, reload };
}
