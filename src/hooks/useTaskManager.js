import { useCallback, useRef, useState } from "react";

/**
 * Centralised task / error state.
 *
 * - Only ONE task can be active at a time. Starting a new task cancels
 *   the previous one (matching the original behaviour but explicit).
 * - `A(args)` returns args with the current AbortSignal attached, so
 *   any downstream fetch can be cancelled.
 * - The previous controller is kept in a ref so we can abort it on
 *   unmount, not just on the next startTask.
 */
export function useTaskManager() {
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const abortRef = useRef(null);

  const cancelTask = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const startTask = useCallback((label, total = 1) => {
    // Abort any previous task before starting a new one.
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy({ label, done: 0, total });
  }, []);

  const endTask = useCallback(() => {
    // Only clear the controller if it's still ours.
    if (abortRef.current?.signal.aborted) abortRef.current = null;
    setBusy(null);
  }, []);

  const fail = useCallback((msg, e) => {
    const isCancelled = e?.message === "Cancelled";
    setErr(isCancelled ? "Cancelled." : `${msg}: ${e?.message || e}`);
  }, []);

  const clearErr = useCallback(() => setErr(""), []);

  /** Attach the current AbortSignal to a request args object. */
  const A = useCallback(
    (args) => ({ ...args, signal: abortRef.current?.signal }),
    []
  );

  /** True if the current task has been cancelled. */
  const isAborted = useCallback(() => !!abortRef.current?.signal.aborted, []);

  /** Refresh the busy progress bar. */
  const tick = useCallback((label) => {
    setBusy((b) => b && {
      ...b,
      done: b.done + 1,
      label: label || b.label,
    });
  }, []);

  return {
    busy,
    err,
    setErr,
    setBusy,
    startTask,
    endTask,
    cancelTask,
    fail,
    clearErr,
    A,
    isAborted,
    tick,
    abortRef,
  };
}
