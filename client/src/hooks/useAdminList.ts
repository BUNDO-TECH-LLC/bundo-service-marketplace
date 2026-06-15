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
  const listKey = `${enabled}:${extraKey}`;

  const selectRef = useRef(options.select);
  selectRef.current = options.select;
  const extraParamsRef = useRef(options.extraParams);
  extraParamsRef.current = options.extraParams;

  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prevListKey, setPrevListKey] = useState(listKey);
  if (prevListKey !== listKey) {
    setPrevListKey(listKey);
    setPage(1);
  }

  const fetchGenerationRef = useRef(0);

  const fetchPage = useCallback(
    async (targetPage: number) => {
      if (!enabled) {
        setLoading(false);
        setItems([]);
        setTotal(0);
        setError(null);
        return;
      }

      const generation = ++fetchGenerationRef.current;
      setLoading(true);
      setError(null);
      setItems([]);

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

        if (generation !== fetchGenerationRef.current) {
          return;
        }

        const list = selectRef.current(response);
        setItems(list);
        setTotal(response.meta?.total ?? list.length);
      } catch (caught) {
        if (generation !== fetchGenerationRef.current) {
          return;
        }

        setError(caught instanceof Error ? caught.message : 'Could not load this list.');
        setItems([]);
        setTotal(0);
      } finally {
        if (generation === fetchGenerationRef.current) {
          setLoading(false);
        }
      }
    },
    [token, path, limit, enabled]
  );

  useEffect(() => {
    void fetchPage(page);
  }, [page, fetchPage, listKey]);

  const reload = useCallback(() => fetchPage(page), [fetchPage, page]);

  return { items, total, page, limit, loading, error, setPage, reload };
}
