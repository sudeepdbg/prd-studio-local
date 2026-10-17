import { useEffect } from "react";

/**
 * Wire keyboard shortcuts to handlers.
 *
 * Pass a map of { combo: handler } where combo is a string like
 * "mod+z" (mod = Cmd on macOS, Ctrl elsewhere) or "shift+mod+z".
 * Handlers are stable: pass them via a ref if they change.
 *
 * Ignores key events originating from input/textarea/select/contentEditable
 * so typing in form fields isn't hijacked.
 */
export function useKeyboard(shortcuts) {
  useEffect(() => {
    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const onKey = (e) => {
      const t = e.target;
      const tag = t?.tagName;
      const isField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t?.isContentEditable;

      for (const [combo, fn] of shortcuts) {
        const parts = combo.toLowerCase().split("+");
        const key = parts[parts.length - 1];
        const wantMod = parts.includes("mod") || parts.includes("cmd") || parts.includes("ctrl");
        const wantShift = parts.includes("shift");
        const wantAlt = parts.includes("alt");
        const modOk = wantMod ? (isMac ? e.metaKey : e.ctrlKey) : !e.metaKey && !e.ctrlKey;
        if (
          e.key.toLowerCase() === key &&
          modOk &&
          e.shiftKey === wantShift &&
          e.altKey === wantAlt &&
          (!isField || (wantMod && (key === "z" || key === "y")))
        ) {
          e.preventDefault();
          fn(e);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcuts]);
}
