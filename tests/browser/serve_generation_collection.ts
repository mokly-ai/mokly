/**
 * Emulated generation collection for Serve journeys. Serve collects an idle
 * generation after 60 seconds, which a browser spec cannot wait for, so
 * `page.route` makes the generation's files disappear as a collection does.
 * Serve itself keeps no test seam.
 */

import type { Page } from "@playwright/test";

import { SELECTED_ENDPOINT } from "./serve_comparison_ui.js";

/** One emulated collection. */
export interface CollectedGeneration {
  /** Each request that reached the generation while it was gone. */
  refused(): string[];
}

/**
 * Collect the generation of `review` at its next renewal. That HEAD answers
 * 404, and while the generation is gone every request for one of its files
 * answers 404 too, so a viewer that reuses an old address fails.
 *
 * A selected generation stays gone. The next request to the stable endpoint
 * then captures a new generation, as Serve does once the old one is
 * collected; the emulation forwards that one request as a refresh. An
 * advertised classification generation comes back when the viewer reacquires
 * its `review.json`, as Serve restores its snapshots from the base capture.
 */
export async function collectGeneration(
  page: Page,
  review: string,
): Promise<CollectedGeneration> {
  const directory = review.slice(0, review.lastIndexOf("/") + 1);
  const selected = new URL(directory).pathname.includes(
    "/generations/selected-",
  );
  let state: "collected" | "live" | "restored" = "live";
  const refused: string[] = [];
  await page.route(`${directory}**`, async (route) => {
    const request = route.request();
    const metadata = request.url() === review;
    if (state === "live" && metadata && request.method() === "HEAD") {
      state = "collected";
      await route.fulfill({ status: 404 });
      return;
    }
    if (state !== "collected") {
      await route.continue();
      return;
    }
    if (!selected && metadata && request.method() === "GET") {
      await route.fulfill({ response: await route.fetch() });
      state = "restored";
      return;
    }
    refused.push(`${request.method()} ${request.url()}`);
    await route.fulfill({ status: 404 });
  });
  let replaced = false;
  if (selected)
    await page.route(`**${SELECTED_ENDPOINT}?*`, async (route) => {
      const url = new URL(route.request().url());
      if (
        state === "collected" &&
        !replaced &&
        !url.searchParams.has("refresh")
      ) {
        // Only the first request after the collection captures anew; Serve
        // retains that capture for the requests that follow.
        replaced = true;
        url.searchParams.set("refresh", "1");
        await route.continue({ url: url.href });
        return;
      }
      await route.continue();
    });
  return { refused: () => [...refused] };
}
