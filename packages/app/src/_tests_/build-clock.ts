import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { buildPollIntervalMs } from "../viewer/build-poll";

/** The window property where the page counts its build and log reads. */
const counter = "__mkcBuildReads";

interface ReadCount {
  started: number;
  finished: number;
}

/** The build and log reads of one build, as a path pattern. */
const buildReads = String.raw`^/v1/projects/[^/]+/builds/[^/]+(/log)?$`;

/**
 * Put the page on Playwright's clock before it opens a build, and count every
 * read that the page starts and finishes: each build and log read, or each
 * GET whose path matches `reads`. The clock still runs in real time;
 * `nextPoll` brings the next poll forward, so a test need not wait three
 * seconds for it. Each read is still the card's real request.
 */
export async function installPollClock(
  page: Page,
  reads = buildReads,
): Promise<void> {
  await page.addInitScript(
    ([name, pattern]) => {
      const count = { started: 0, finished: 0 };
      const reads = new RegExp(pattern);
      const original = window.fetch.bind(window);
      Object.assign(window, { [name]: count });
      window.fetch = (input, init) => {
        const request = input instanceof Request ? input : undefined;
        const url = new URL(
          request?.url ?? String(input),
          window.location.href,
        );
        const method = init?.method ?? request?.method ?? "GET";
        if (method.toUpperCase() !== "GET" || !reads.test(url.pathname))
          return original(input, init);
        count.started += 1;
        return original(input, init).finally(() => {
          count.finished += 1;
        });
      };
    },
    [counter, reads] as const,
  );
  await page.clock.install();
}

/** Let one poll interval pass on the page, which starts the card's next read. */
export async function nextPoll(page: Page): Promise<void> {
  await page.clock.runFor(buildPollIntervalMs);
}

/**
 * Let poll intervals pass on the page, one for each look, until `shown` is on
 * it. A build that a real worker moves reaches each state on the worker's own
 * time, so a test cannot tell which poll will read it; each look still waits
 * for the card's real read.
 */
export async function pollUntilShown(
  page: Page,
  shown: Locator,
): Promise<void> {
  await expect
    .poll(async () => {
      await nextPoll(page);
      return shown.count();
    })
    .toBeGreaterThan(0);
}

/**
 * Wait until no counted read of the page is in flight, and return how many it
 * has started. A finished read has passed the build double, so the double has
 * counted it too. Each look first lets the page finish its current
 * task, so a read that a timer just started is already counted.
 */
export async function settledReads(page: Page): Promise<number> {
  const look = () =>
    page.evaluate(
      (name) =>
        new Promise<ReadCount>((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = () =>
            resolve((window as unknown as Record<string, ReadCount>)[name]);
          channel.port2.postMessage(null);
        }),
      counter,
    );
  await expect
    .poll(async () => {
      const { started, finished } = await look();
      return started - finished;
    })
    .toBe(0);
  return (await look()).started;
}
