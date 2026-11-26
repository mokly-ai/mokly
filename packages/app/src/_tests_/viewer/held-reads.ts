import type { Page } from "@playwright/test";

import { expect } from "../harness";

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

/**
 * Wait for a held request. It fails with the name of the request after the
 * suite's assertion timeout, as a web-first assertion does, rather than
 * holding the test until its own timeout.
 */
export async function arrival(
  arrived: Promise<void>,
  what: string,
): Promise<void> {
  // The `expect.timeout` of `playwright.config.ts`.
  const limit = 15_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${what} did not arrive within ${limit} ms`)),
      limit,
    );
  });
  try {
    await Promise.race([arrived, late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hold a successful real read until a test has checked the pending body.
 * `arrived()` settles once the first matching read has answered and is held.
 */
export async function holdViewerRead(
  page: Page,
  matches: (url: URL) => boolean,
): Promise<{ arrived: () => Promise<void>; release: () => void }> {
  const pending = Promise.withResolvers<void>();
  const held = Promise.withResolvers<void>();
  await page.route(matches, async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    held.resolve();
    await pending.promise;
    await route.fulfill({ response });
  });
  return {
    arrived: () => arrival(held.promise, "the held viewer read"),
    release: () => pending.resolve(),
  };
}
