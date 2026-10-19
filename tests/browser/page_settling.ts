/** Waits that settle a page after held requests, without the clock. */

import type { Page, Request } from "@playwright/test";

/**
 * Every request that the browser finished or failed after this call. A held
 * request ends either way, also when a navigation cancelled it, so a spec
 * waits for its end instead of the clock.
 */
export function endedRequests(page: Page): ReadonlySet<Request> {
  const ended = new Set<Request>();
  const end = (request: Request): void => {
    ended.add(request);
  };
  page.on("requestfinished", end);
  page.on("requestfailed", end);
  return ended;
}

/** Let a few rendering updates of the page pass. */
export async function passRenderingUpdates(page: Page): Promise<void> {
  for (let frames = 0; frames < 3; frames += 1)
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );
}
