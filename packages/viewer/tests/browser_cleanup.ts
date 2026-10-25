/** Resources acquired during setup are owned before setup can fail. */
const cleanups = new Set<() => Promise<void>>();

export function ownBrowserCleanup(close: () => Promise<void>): void {
  cleanups.add(close);
}

export async function drainBrowserFixtures(): Promise<void> {
  const failures: unknown[] = [];
  for (const close of [...cleanups].reverse()) {
    try {
      await close();
      cleanups.delete(close);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Browser fixture teardown failed");
}
