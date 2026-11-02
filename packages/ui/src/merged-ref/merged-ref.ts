/**
 * One ref for an element that a component and its host both need: the
 * component keeps the element in its own ref, and the host receives it
 * through the ref that it passes.
 */

import { useCallback, type Ref, type RefCallback, type RefObject } from "react";

/** Give an element to a ref, and return what takes it back. */
function attach<T>(ref: Ref<T> | undefined, element: T | null): () => void {
  if (typeof ref === "function") {
    const cleanup = ref(element);
    return typeof cleanup === "function" ? cleanup : () => ref(null);
  }
  if (!ref) return () => {};
  ref.current = element;
  return () => {
    ref.current = null;
  };
}

/**
 * The ref callback of an element that the component keeps in `own` and that
 * the host receives through `host`. The callback stays the same while `host`
 * does, so React keeps the element attached across renders.
 */
export function useMergedRef<T>(
  own: RefObject<T | null>,
  host: Ref<T> | undefined,
): RefCallback<T> {
  return useCallback(
    (element: T | null) => {
      own.current = element;
      const release = attach(host, element);
      return () => {
        own.current = null;
        release();
      };
    },
    [own, host],
  );
}
