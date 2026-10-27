/**
 * Failed renewals in Serve. A selected generation expires after 60 idle
 * seconds, which a browser spec cannot wait for, so `removeGeneration`
 * emulates the collection: once the panes have loaded, the generation is
 * gone, its renewal answers 404, and every other request for its files is
 * refused. Serve keeps an advertised classification generation's JSON and
 * recaptures its snapshots, so the removed-preview journeys use the same
 * failed renewal only to exercise the shell's reacquire of the advertised
 * URL. The shell must renew, then reacquire the comparison or preview before
 * it shows the new view, and never request an old document address.
 */

import { expect, type Page } from "@playwright/test";

import { modeButton } from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";
import {
  expectCardPane,
  generationOf,
  loadComparison,
  PANE_SOURCE,
  selectedRequests,
} from "./serve_comparison_ui.js";
import { removeGeneration } from "./serve_generation_removal.js";
import { responseFailure } from "./shell_error_allowances.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

const after = ".mb-pane--after iframe";
const before = ".mb-pane--before iframe";
const stage = "[data-mokly-preview]";
// The documents that must finish loading before a generation goes.
const panes = "[data-diff-stage] iframe";
const previews = `${stage} iframe`;

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
    allowBrowserError(
      responseFailure(changes.url, new URL(expired).pathname, 404),
    );
    const removal = await removeGeneration(page, expired, page.locator(panes));

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
    expect(removal.renewed()).toBe(true);
    expect(removal.refused()).toEqual([]);
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
  const requests = selectedRequests(page);
  const failed = failedSnapshots(page);
  await page.goto(`/view/${variant}/`);
  await chooseViewport(page, "desktop");
  await loadComparison(page, "Side by side");
  await expectCardPane(page, "after", "Featured After");
  const expired = generationOf(
    (await page.locator(after).getAttribute(PANE_SOURCE))!,
  );
  allowBrowserError(
    responseFailure(changes.url, new URL(expired).pathname, 404),
  );
  const removal = await removeGeneration(page, expired, page.locator(panes));
  await chooseViewport(page, "mobile");
  await expect(page.locator(after)).toHaveAttribute(
    PANE_SOURCE,
    /\.mobile\.html$/u,
  );
  await expectCardPane(page, "before", "Featured Before");
  await expectCardPane(page, "after", "Featured After");
  expect(
    generationOf((await page.locator(after).getAttribute(PANE_SOURCE))!),
  ).not.toBe(expired);
  expect(removal.renewed()).toBe(true);
  expect(removal.refused()).toEqual([]);
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
    const root = new URL(index.comparisonUrl!, changes.url).href;
    // A removed screen's preview renews its removed detail in the generation.
    const detail = `${root}entries/${record.entry.path}.json`;
    allowBrowserError(
      responseFailure(changes.url, new URL(detail).pathname, 404),
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
      if (request.url() === detail) metadata.push(request.method());
    });
    const removal = await removeGeneration(
      page,
      root,
      page.locator(previews),
      detail,
    );

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
    expect(generationOf((await renewed.getAttribute(PANE_SOURCE))!)).toBe(root);
    expect(removal.renewed()).toBe(true);
    expect(removal.refused()).toEqual([]);
    expect(metadata).toEqual(["HEAD", "GET"]);
    expect(selections).toEqual([]);
    expect(failed).toEqual([]);
  });
