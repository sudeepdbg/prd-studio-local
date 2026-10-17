import { useCallback, useRef, useState } from "react";
import { TUNABLES } from "../constants.js";

/**
 * Screens state with undo/redo history.
 *
 * The original code mutated `hist.current` in place which made the
 * undo/redo stack fragile. This hook formalises the same logic but
 * keeps the stack in a single ref and exposes stable callbacks.
 *
 * Debouncing: rapid edits within UNDO_DEBOUNCE_MS collapse into a
 * single history entry, so undo doesn't replay every keystroke.
 */
export function useScreens(initial = []) {
  const [screens, setScreensRaw] = useState(initial);
  const screensRef = useRef(initial);
  const hist = useRef({ past: [], future: [], lastPush: 0 });

  const setScreens = useCallback((updater) => {
    const prev = screensRef.current;
    const next = typeof updater === "function" ? updater(prev) : updater;
    if (next === prev) return;
    const now = Date.now();
    const h = hist.current;
    if (now - h.lastPush > TUNABLES.UNDO_DEBOUNCE_MS) {
      h.past.push(prev);
      if (h.past.length > TUNABLES.UNDO_STACK_MAX) h.past.shift();
    }
    h.lastPush = now;
    h.future = [];
    screensRef.current = next;
    setScreensRaw(next);
  }, []);

  const undo = useCallback(() => {
    const h = hist.current;
    if (!h.past.length) return;
    h.future.push(screensRef.current);
    const prev = h.past.pop();
    h.lastPush = 0;
    screensRef.current = prev;
    setScreensRaw(prev);
  }, []);

  const redo = useCallback(() => {
    const h = hist.current;
    if (!h.future.length) return;
    h.past.push(screensRef.current);
    const next = h.future.pop();
    h.lastPush = 0;
    screensRef.current = next;
    setScreensRaw(next);
  }, []);

  const resetHistory = useCallback((next) => {
    hist.current = { past: [], future: [], lastPush: 0 };
    screensRef.current = next;
    setScreensRaw(next);
  }, []);

  return {
    screens,
    screensRef,
    setScreens,
    undo,
    redo,
    resetHistory,
    canUndo: hist.current.past.length > 0,
    canRedo: hist.current.future.length > 0,
  };
}
