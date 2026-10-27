/** Delivered Changes over the native M9 base preparation path. */
import { expect } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";

import {
  changedEntries,
  changesVisible,
  delivered,
  observeDelivery,
} from "./delivery.js";
import type { PreparedFixture } from "./setup.js";

export const firstScreen = "area-1/screens/activity-group-1/screen-1";

/**
 * The delivered Changes as the index publishes them: the pinned base commit,
 * the current entry count, the included count, and the comparison root.
 */
export function changesSummary(
  fixture: PreparedFixture,
  current: Awaited<ReturnType<typeof delivered>>,
) {
  const index = current.index;
  if (!index.comparisonUrl) throw new Error("Ready Changes has no comparison");
  if (index.baseCommit !== fixture.baseline)
    throw new Error(
      `Changes used ${String(index.baseCommit)}, expected ${fixture.baseline}`,
    );
  return {
    baseCommit: index.baseCommit,
    entries:
      index.screens.length +
      index.components.length +
      index.pages.length +
      index.documents.length +
      index.useCases.length,
    included: changedEntries(index).length,
    comparisonUrl: index.comparisonUrl,
  };
}

export async function changes(
  context: BrowserContext,
  url: string,
  fixture: PreparedFixture,
  beginning: number,
) {
  const page = await context.newPage();
  await observeDelivery(page);
  await page.goto(`${url}/view/${firstScreen}/`);
  const current = await delivered(page);
  const indexReadyMs = performance.now() - beginning;
  await changesVisible(page, current.index);
  const changesReadyMs = performance.now() - beginning;
  const summary = changesSummary(fixture, current);
  if (summary.included)
    throw new Error(
      `The unrelated CSS edit produced Changes: ${JSON.stringify(summary)}`,
    );
  await page.locator("[data-filter=changed]").click();
  await expect(page.locator("[data-nav-status-text]")).toHaveText(
    "No changes found.",
  );
  return {
    indexReadyMs,
    changesReadyMs,
    summary,
    publication: current.publication,
    revision: current.index.revision,
    generation: current.index.live?.generation,
  };
}
