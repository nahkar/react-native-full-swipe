import { useCallback, useEffect, useRef, useState } from 'react';

export type UseUndoOptions = {
  /** How long the item can be brought back, in ms. Defaults to `5000`. */
  timeout?: number;
};

export type Undo<T> = {
  /** The last removed item, for as long as it can still be brought back; `null` otherwise. */
  item: T | null;
  /** Holds `item` for `timeout` ms, replacing whatever was held. Call it from `onRemove`. */
  push: (item: T) => void;
  /** Hands back the held item and stops holding it — call from the undo button and restore what it returns. */
  take: () => T | null;
  /** Stops holding the item without bringing it back. */
  clear: () => void;
};

/**
 * The last thing swiped away, held for a few seconds so it can be brought
 * back. A swipe is a gesture, and a gesture is easy to make by accident.
 *
 * Pushing again restarts the countdown, even for an equal item.
 */
export function useUndo<T>({ timeout = 5000 }: UseUndoOptions = {}): Undo<T> {
  const [held, setHeld] = useState<{ item: T } | null>(null);
  const heldRef = useRef(held);
  heldRef.current = held;

  useEffect(() => {
    if (!held) return;
    const timer = setTimeout(() => setHeld(null), timeout);
    return () => clearTimeout(timer);
  }, [held, timeout]);

  // A fresh wrapper each push, so the countdown restarts for an equal item.
  const push = useCallback((item: T) => setHeld({ item }), []);

  const take = useCallback(() => {
    const current = heldRef.current;
    heldRef.current = null;
    setHeld(null);
    return current ? current.item : null;
  }, []);

  const clear = useCallback(() => {
    heldRef.current = null;
    setHeld(null);
  }, []);

  return { item: held ? held.item : null, push, take, clear };
}
