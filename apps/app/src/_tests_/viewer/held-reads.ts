import type { Page } from "@playwright/test";

/**
 * Hold every GET whose address the predicate matches until the test lets them
 * go, so a wait can be seen while its read runs. `arrived` settles once the
 * first of them is held; a read that starts after the release goes through.
 */
export async function holdReads(
  page: Page,
  matches: (url: URL) => boolean,
): Promise<{ arrived: Promise<void>; release: () => void }> {
  const gate = Promise.withResolvers<void>();
  const arrived = Promise.withResolvers<void>();
  await page.route(matches, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    arrived.resolve();
    await gate.promise;
    return route.fallback();
  });
  return { arrived: arrived.promise, release: () => gate.resolve() };
}

/** The route's read of the project its address names. */
export function projectRead(url: URL): boolean {
  return /^\/v1\/workspaces\/by-slug\/[^/]+\/projects\/[^/]+$/.test(
    url.pathname,
  );
}
