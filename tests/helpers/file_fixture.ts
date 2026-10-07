import { after } from "node:test";

/** Collect cleanup hooks for output owned by one fixture setup. */
export interface FixtureOwner {
  /** Register an asynchronous cleanup before returning from setup. */
  after(hook: () => Promise<void>): void;
}

/**
 * Register file teardown now and start one shared setup on first use.
 * Teardown waits for setup, including failure, before attempting every owned
 * cleanup in reverse order. The awaiting test reports setup failures; teardown
 * reports cleanup failures. A file with no selected tests starts no setup.
 */
export function fileFixture<T>(
  setup: (owner: FixtureOwner) => Promise<T>,
  register: (hook: () => Promise<void>) => void = after,
): () => Promise<T> {
  let pending: Promise<T> | undefined;
  const cleanups: (() => Promise<void>)[] = [];
  const owner: FixtureOwner = {
    after: (hook) => {
      cleanups.push(hook);
    },
  };
  register(async () => {
    if (!pending) return;
    try {
      await pending;
    } catch {
      // The test awaiting setup reports its failure.
    }
    const failures: unknown[] = [];
    for (const cleanup of [...cleanups].reverse()) {
      try {
        await cleanup();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1)
      throw new AggregateError(failures, "file fixture cleanup failed");
  });
  return () => {
    pending ??= Promise.resolve().then(() => setup(owner));
    return pending;
  };
}
