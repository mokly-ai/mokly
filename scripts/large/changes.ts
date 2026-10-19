/** Delivered Changes over the native M9 base preparation path. */
import { expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

import { parseReviewResult } from "../../packages/viewer/src/review/result_validation.js";

import {
  changedEntries,
  changesVisible,
  delivered,
  observeDelivery,
} from "./delivery.js";
import type { PreparedFixture } from "./setup.js";

export const firstScreen = "area-1/screens/activity-group-1/screen-1";

export async function availableReview(
  page: Page,
  fixture: PreparedFixture,
  current: Awaited<ReturnType<typeof delivered>>,
) {
  if (!current.index.comparisonUrl)
    throw new Error("Ready Changes has no review URL");
  const raw: unknown = await page.evaluate(async (url) => {
    const response = await fetch(new URL(url, location.origin), {
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok)
      throw new Error(`Review returned HTTP ${response.status}`);
    return response.json();
  }, current.index.comparisonUrl);
  const review = parseReviewResult(raw);
  if (review.baseCommit !== fixture.baseline)
    throw new Error(
      `Review used ${review.baseCommit}, expected ${fixture.baseline}`,
    );
  return {
    baseCommit: review.baseCommit,
    entries: review.entries.length,
    included: review.entries
      .flatMap((entry) => [entry, ...(entry.variants ?? [])])
      .filter((entry) => entry.included).length,
    affected: review.affected.length,
    comparisonUrl: current.index.comparisonUrl,
  };
}

export async function changes(
  browser: Browser,
  url: string,
  fixture: PreparedFixture,
  beginning: number,
) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  context.setDefaultTimeout(60_000);
  context.setDefaultNavigationTimeout(60_000);
  try {
    const page = await context.newPage();
    await observeDelivery(page);
    await page.goto(`${url}/view/${firstScreen}/`);
    const current = await delivered(page);
    const indexReadyMs = performance.now() - beginning;
    await changesVisible(page, current.index);
    const changesReadyMs = performance.now() - beginning;
    const review = await availableReview(page, fixture, current);
    const reviewAvailableMs = performance.now() - beginning;
    if (
      changedEntries(current.index).length ||
      review.included ||
      review.affected
    )
      throw new Error(
        `The unrelated CSS edit produced Changes: ${JSON.stringify(review)}`,
      );
    await page.locator("[data-filter=changed]").click();
    await expect(page.locator("[data-nav-status-text]")).toHaveText(
      "No changes found.",
    );
    return {
      indexReadyMs,
      changesReadyMs,
      reviewAvailableMs,
      review,
      publication: current.publication,
      revision: current.index.revision,
      generation: current.index.live?.generation,
    };
  } finally {
    await context.close();
  }
}
