const SLICE_MS = 4;
let started = performance.now();
let pending: Promise<void> | undefined;

/** All synchronous read loops share one slice and one pending event-loop yield. */
export function cooperativeYield(): Promise<void> | undefined {
  if (pending) return pending;
  if (performance.now() - started < SLICE_MS) return undefined;
  pending = new Promise<void>((resolve) => {
    setImmediate(() => {
      started = performance.now();
      pending = undefined;
      resolve();
    });
  });
  return pending;
}
