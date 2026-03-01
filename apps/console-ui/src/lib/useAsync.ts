import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared hook that eliminates the repeated loading / error / try-catch
 * boilerplate found across every data-fetching page.
 *
 * Usage:
 * ```ts
 * const { loading, error, run } = useAsync();
 *
 * async function loadItems() {
 *   await run(async () => {
 *     const res = await apiClient.listItems();
 *     setItems(res.data.items);
 *   });
 * }
 * ```
 *
 * `run` returns the value produced by the callback (or `undefined` on error)
 * so callers can chain logic after a successful call.
 */

export interface UseAsyncReturn {
  /** `true` while the latest `run` call is in flight. */
  loading: boolean;
  /** The error message from the most recent failed `run`, or `null`. */
  error: string | null;
  /** Optional warning (non-fatal). Pages can set it via `setWarning`. */
  warning: string | null;
  /** Set an error message manually (e.g. validation). */
  setError: (message: string | null) => void;
  /** Set a warning message manually. */
  setWarning: (message: string | null) => void;
  /**
   * Execute `fn` inside a managed loading / error envelope.
   *
   * - Sets `loading = true` before the call.
   * - Catches any thrown error and stores its message.
   * - Sets `loading = false` when done (success or failure).
   * - Returns the value produced by `fn`, or `undefined` on error.
   */
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
}

export function useAsync(initialLoading = true): UseAsyncReturn {
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Guard against state updates after unmount.
  // Re-set to `true` on every effect run so React StrictMode's
  // unmount-then-remount cycle in dev mode does not permanently
  // disable state updates.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
      setLoading(true);
      setError(null);

      try {
        const result = await fn();
        if (mountedRef.current) {
          setLoading(false);
        }
        return result;
      } catch (caught: unknown) {
        if (mountedRef.current) {
          setError(
            caught instanceof Error ? caught.message : "An unexpected error occurred"
          );
          setLoading(false);
        }
        return undefined;
      }
    },
    []
  );

  return { loading, error, warning, setError, setWarning, run };
}
