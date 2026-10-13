import { useCallback, useEffect, useRef, useState } from "react";

interface PollingResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * Polls `fetcher` on an interval. Used instead of a WebSocket client so
 * this LAN client stays dependency-light; swap the interval for a
 * subscription to `WsEvent`s from print-common if/when that lands.
 */
export function usePolling<T>(fetcher: (signal: AbortSignal) => Promise<T>, intervalMs = 4000): PollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback((signal: AbortSignal) => {
    fetcherRef.current(signal)
      .then((result) => {
        if (signal.aborted) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (signal.aborted) return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });
  }, []);

  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    run(controller.signal);
    const id = setInterval(() => run(controller.signal), intervalMs);
    return () => {
      controller.abort();
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, intervalMs, tick]);

  return { data, error, loading, refresh };
}
