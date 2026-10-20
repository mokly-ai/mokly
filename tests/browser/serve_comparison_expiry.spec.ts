/**
 * Failed renewals in Serve. A selected generation expires after 60 idle
 * seconds, which a browser spec cannot wait for, so `collectGeneration`
 * emulates the collection: the next renewal answers 404 and the generation's
 * files are gone. Serve keeps an advertised classification generation's
 * JSON and recaptures its snapshots, so the removed-preview journeys use the
 * same failed renewal only to exercise the shell's reacquire of the
 * advertised URL. The shell must reacquire the comparison or preview before
 * it shows the new view, and never request an old document address.
 */

import { expect, type Page } from "@playwright/test";

import { modeButton } from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";
import {
  generationOf,
  loadComparison,
  PANE_SOURCE,
  selectedRequests,
} from "./serve_comparison_ui.js";
import { collectGeneration } from "./serve_generation_collection.js";
import { responseFailure } from "./shell_error_allowances.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

const after = ".mb-pane--after iframe";
const before = ".mb-pane--before iframe";
const stage = "[data-mokly-preview]";

/** Every snapshot response that failed while the spec ran. */
function failedSnapshots(page: Page): string[] {
  const failed: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/snapshots/") && !response.ok())
      failed.push(response.url());
  });
  return failed;
}

for (const change of ["theme", "viewport"] as const)
  test(`an idle Difference recovers expired snapshots before changing ${change}`, async ({
    page,
    changes,
    allowBrowserError,
  }) => {
    const changed = changes.paths.changed;
    const requests = selectedRequests(page);
    const failed = failedSnapshots(page);
    await page.goto(`/view/${changed}/`);
    await chooseViewport(page, "desktop");
    await chooseScheme(page, "light");
    await loadComparison(page, "Overlay");
    await modeButton(page, "Difference").click();
    // The mode switch renews the generation first; its panes show only after.
    await expect(page.locator(".mb-panes")).toHaveAttribute(
      "data-compare-mode",
      "difference",
    );
    await expect(page.frameLocator(before).locator("h1")).toHaveText(
      "Before screen",
    );
    await expect(page.frameLocator(after).locator("h1")).toHaveText(
      "After screen",
    );
    await expect(page.locator("[data-diff-stage]")).not.toHaveAttribute(
      "aria-busy",
      "true",
    );
    const expired = generationOf(
      (await page.locator(after).getAttribute(PANE_SOURCE))!,
    );
    const review = `${expired}review.json`;
    allowBrowserError(
      responseFailure(changes.url, new URL(review).pathname, 404),
    );
    const collection = await collectGeneration(page, review);

    if (change === "theme") await chooseScheme(page, "dark");
    else await chooseViewport(page, "mobile");

    await expect(page.locator(after)).toHaveAttribute(
      PANE_SOURCE,
      change === "theme" ? /\.desktop\.dark\.html$/u : /\.mobile\.html$/u,
    );
    await expect(page.frameLocator(before).locator("h1")).toHaveText(
      "Before screen",
    );
    await expect(page.frameLocator(after).locator("h1")).toHaveText(
      "After screen",
    );
    await expect(page.locator(".mb-panes")).toHaveAttribute(
      "data-compare-mode",
      "difference",
    );
    // The reacquired comparison is a new generation, and the shell asked the
    // collected one for nothing after its renewal failed.
    for (const pane of [before, after])
      expect(
        generationOf((await page.locator(pane).getAttribute(PANE_SOURCE))!),
      ).not.toBe(expired);
    expect(collection.refused()).toEqual([]);
    expect(requests).toHaveLength(2);
    expect(requests[1]!.searchParams.get("path")).toBe(changed);
    expect(requests[1]!.searchParams.has("refresh")).toBe(false);
    expect(failed).toEqual([]);
  });

test("snapshot recovery keeps the selected saved variant", async ({
  page,
  changes,
  allowBrowserError,
}) => {
  const variant = changes.paths.changedVariant;
  const label = (pane: string) => page.frameLocator(pane).locator("h2");
  const requests = selectedRequests(page);
  const failed = failedSnapshots(page);
  await page.goto(`/view/${variant}/`);
  await chooseViewport(page, "desktop");
  await loadComparison(page, "Side by side");
  await expect(label(after)).toHaveText("Featured After");
  const expired = generationOf(
    (await page.locator(after).getAttribute(PANE_SOURCE))!,
  );
  const review = `${expired}review.json`;
  allowBrowserError(
    responseFailure(changes.url, new URL(review).pathname, 404),
  );
  const collection = await collectGeneration(page, review);
  await chooseViewport(page, "mobile");
  await expect(page.locator(after)).toHaveAttribute(
    PANE_SOURCE,
    /\.mobile\.html$/u,
  );
  await expect(label(before)).toHaveText("Featured Before");
  await expect(label(after)).toHaveText("Featured After");
  expect(
    generationOf((await page.locator(after).getAttribute(PANE_SOURCE))!),
  ).not.toBe(expired);
  expect(collection.refused()).toEqual([]);
  expect(requests).toHaveLength(2);
  expect(requests[1]!.searchParams.get("path")).toBe(variant);
  expect(requests[1]!.searchParams.size).toBe(1);
  expect(failed).toEqual([]);
});

for (const change of ["scheme", "viewport"] as const)
  test(`an expired preview is reacquired before changing the ${change}`, async ({
    page,
    changes,
    allowBrowserError,
  }) => {
    const index = await changes.index();
    const record = index.removedEntries.find(
      ({ entry }) => entry.path === changes.paths.removedScreen,
    )!;
    const review = new URL(index.comparisonUrl!, changes.url).href;
    allowBrowserError(
      responseFailure(changes.url, new URL(review).pathname, 404),
    );
    const selections = selectedRequests(page);
    const failed = failedSnapshots(page);
    await page.goto(
      `/view/${record.entry.path}/?snapshot=${record.snapshotId}&viewport=desktop`,
    );
    const desktop = page.locator(`${stage} .mbk-frame-desktop iframe`);
    await expect(desktop.contentFrame().locator("h1")).toHaveText(
      "Historical screen",
    );
    const metadata: string[] = [];
    page.on("request", (request) => {
      if (request.url() === review) metadata.push(request.method());
    });
    const collection = await collectGeneration(page, review);

    if (change === "scheme") await chooseScheme(page, "dark");
    else await chooseViewport(page, "mobile");

    const renewed = page.locator(
      `${stage} .mbk-frame-${change === "scheme" ? "desktop" : "mobile"} iframe`,
    );
    await expect(renewed).toHaveAttribute(
      PANE_SOURCE,
      change === "scheme" ? /\.desktop\.dark\.html$/u : /\.mobile\.html$/u,
    );
    await expect(renewed.contentFrame().locator("h1")).toHaveText(
      "Historical screen",
    );
    // The preview reacquired its advertised generation before it asked the
    // generation for any document of the new view.
    expect(generationOf((await renewed.getAttribute(PANE_SOURCE))!)).toBe(
      review.replace(/review\.json$/u, ""),
    );
    expect(collection.refused()).toEqual([]);
    expect(metadata).toEqual(["HEAD", "GET"]);
    expect(selections).toEqual([]);
    expect(failed).toEqual([]);
  });
