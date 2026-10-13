import { useCallback, useRef, useState } from "react";

// Wraps an async action so it runs once at a time: clicks while it's running are ignored (a ref, so even
// two clicks in the same frame can't both get through) and `busy` drives a "Saving…" button.
export function useBusy() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const guard = useCallback(<A extends unknown[]>(fn: (...args: A) => Promise<unknown> | unknown) => async (...args: A) => {
    // A form submit must never fall through to the browser's own submit, even when ignored
    const first = args[0] as { preventDefault?: () => void } | undefined;
    first?.preventDefault?.();
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await fn(...args);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  return [busy, guard] as const;
}
