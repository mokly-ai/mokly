import { useCallback, useEffect, useRef } from "react";

import { isRefreshing } from "./use-resource";
import type { Resource } from "./use-resource";

/** Whether a read of the resource is in flight: a first read or a refresh. */
function inFlight<T>(resource: Resource<T> | undefined): boolean {
  return resource?.status === "loading" || isRefreshing(resource);
}

/**
 * A resource another component reads, as one asynchronous step can wait for
 * it: its value once it has loaded, or nothing when it failed or nobody reads
 * it. A read still in flight, a refresh included, is waited for rather than
 * repeated, so the caller never reads the same thing a second time while the
 * first read runs, and never answers with a value a refresh is replacing.
 *
 * The returned function is stable. Each call answers with the resource as it
 * stands then: at once when it has settled, or when it next settles.
 */
export function useSettled<T>(
  resource: Resource<T> | undefined,
): () => Promise<T | undefined> {
  const latest = useRef(resource);
  const waiting = useRef<((value: T | undefined) => void)[]>([]);
  useEffect(() => {
    latest.current = resource;
    if (inFlight(resource)) return;
    const value = resource?.status === "ready" ? resource.value : undefined;
    for (const wake of waiting.current.splice(0)) wake(value);
  }, [resource]);
  return useCallback(() => {
    const now = latest.current;
    if (inFlight(now)) {
      return new Promise((wake) => waiting.current.push(wake));
    }
    return Promise.resolve(now?.status === "ready" ? now.value : undefined);
  }, []);
}
