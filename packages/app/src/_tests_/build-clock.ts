import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { buildPollIntervalMs } from "../viewer/build-poll";

/** The window property where the page counts its build and log reads. */
const counter = "__mkcBuildReads";

interface ReadCount {
  started: number;
  finished: number;
}

/**
 * Put the page on Playwright's clock before it opens a build, and count every
 * build and log read that the page starts and finishes. The clock still runs
 * in real time; `nextPoll` brings the next poll forward, so a test need not
 * wait three seconds for it. Each read is still the card's real request.
 */
export async function installPollClock(page: Page): Promise<void> {
  await page.addInitScript((name) => {
    const count = { started: 0, finished: 0 };
    const reads = /^\/v1\/projects\/[^/]+\/builds\/[^/]+(\/log)?$/;
    const original = window.fetch.bind(window);
    Object.assign(window, { [name]: count });
    window.fetch = (input, init) => {
      const request = input instanceof Request ? input : undefined;
      const url = new URL(request?.url ?? String(input), window.location.href);
      const method = init?.method ?? request?.method ?? "GET";
      if (method.toUpperCase() !== "GET" || !reads.test(url.pathname))
        return original(input, init);
      count.started += 1;
      return original(input, init).finally(() => {
        count.finished += 1;
      });
    };
  }, counter);
  await page.clock.install();
}

/** Let one poll interval pass on the page, which starts the card's next read. */
export async function nextPoll(page: Page): Promise<void> {
  await page.clock.runFor(buildPollIntervalMs);
}

/**
 * Wait until no build or log read of the page is in flight, and return how
 * many it has started. A finished read has passed the build double, so the
 * double has counted it too. Each look first lets the page finish its current
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
