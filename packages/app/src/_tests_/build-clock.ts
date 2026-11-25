import type { Page } from "@playwright/test";

import { buildPollIntervalMs } from "../viewer/build-poll";

/**
 * Hold the page's timers before it opens a build, so the card reads its build
 * again only when the test lets a poll interval pass. Each read is still the
 * card's real request to the build double; only the wait for it is gone.
 */
export async function holdPolls(page: Page): Promise<void> {
  await page.clock.install();
}

/** Let one poll interval pass on the page, which starts the card's next read. */
export async function nextPoll(page: Page): Promise<void> {
  await page.clock.runFor(buildPollIntervalMs);
}
