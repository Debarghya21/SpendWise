import { useCallback, useEffect, useState } from 'react';

/**
 * Loads data with an async function. Optional polling interval (ms).
 * Returns { data, error, loading, reload }.
 */
export function useFetch(fn, deps = [], intervalMs = 0) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    try {
      setData(await fn());
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    load();
    if (!intervalMs) return undefined;
    const t = setInterval(load, intervalMs);
    return () => clearInterval(t);
  }, [load, intervalMs]);

  return { data, error, loading, reload: load };
}
