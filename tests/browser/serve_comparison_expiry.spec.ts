/**
 * Failed renewals in Serve. A selected generation expires after 60 idle
 * seconds, which a browser spec cannot wait for, so `removeGeneration`
 * emulates the collection: once the panes have loaded, the generation is
 * gone, its renewal answers 404, and every other request for its files is
 * refused. Serve keeps an advertised classification generation's JSON and
 * recaptures its snapshots, so the removed-preview journeys use the same
 * failed renewal only to exercise the shell's reacquire of the advertised
 * URL. The shell must renew, then reacquire the comparison or preview before
 * it shows the new view, and never request an old document address. On the
 * canvas the Frames filter changes the shown views: a standalone shell's
 * Appearance colours only the chrome, and a variant set has no viewport. The
 * filter stands in Inspect, and the canvas shows a mode only while Changes is
 * the selected tab, so a comparison selects Changes again after the filter.
 */

import { expect, type Page } from "@playwright/test";

import {
  comparisonSection,
  frameModes,
  paneFrame,
} from "./comparison_sections.js";
import { chooseMode, compareStage, comparisonFrames } from "./comparison_ui.js";
import { historicalFrame } from "./previous_version.js";
import {
  closeReadOnlyCatalogue,
  test,
} from "./serve_comparison_read_only_test.js";
import {
  expectCardPane,
  generationOf,
  loadComparison,
  PANE_SOURCE,
  selectedRequests,
} from "./serve_comparison_ui.js";
import { removeGeneration } from "./serve_generation_removal.js";
import { responseFailure } from "./shell_error_allowances.js";
import {
  chooseViewport,
  openPanelTab,
  setFrames,
} from "./workspace_actions.js";

test.afterAll(closeReadOnlyCatalogue);

const stage = "[data-mokly-preview]";
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
    await setFrames(page, { light: true, dark: false });
    await loadComparison(page, "Overlay");
    await chooseMode(page, "Difference");
    // The mode switch renews the generation first; its panes show only after.
    const first = comparisonSection(page, "desktop");
    await expect(frameModes(first)).toHaveAttribute(
      "data-compare-mode",
      "difference",
    );
    await expect(
      paneFrame(first, "before").contentFrame().locator("h1"),
    ).toHaveText("Before screen");
    await expect(
      paneFrame(first, "after").contentFrame().locator("h1"),
    ).toHaveText("After screen");
    await expect(compareStage(page)).not.toHaveAttribute("aria-busy", "true");
    const expired = generationOf(
      (await paneFrame(first, "after").getAttribute(PANE_SOURCE))!,
    );
    allowBrowserError(
      responseFailure(changes.url, new URL(expired).pathname, 404),
    );
    const removal = await removeGeneration(
      page,
      expired,
      comparisonFrames(page),
    );

    if (change === "theme") await setFrames(page, { dark: true, light: false });
    else await chooseViewport(page, "mobile");
    await openPanelTab(page, "Changes");

    const shown =
      change === "theme"
        ? comparisonSection(page, "desktop", "dark")
        : comparisonSection(page, "mobile");
    await expect(paneFrame(shown, "after")).toHaveAttribute(
      PANE_SOURCE,
      change === "theme" ? /\.desktop\.dark\.html$/u : /\.mobile\.html$/u,
    );
    await expect(
      paneFrame(shown, "before").contentFrame().locator("h1"),
    ).toHaveText("Before screen");
    await expect(
      paneFrame(shown, "after").contentFrame().locator("h1"),
    ).toHaveText("After screen");
    await expect(frameModes(shown)).toHaveAttribute(
      "data-compare-mode",
      "difference",
    );
    // The reacquired comparison is a new generation, and the shell asked the
    // collected one for nothing after its renewal failed.
    for (const side of ["before", "after"] as const)
      expect(
        generationOf((await paneFrame(shown, side).getAttribute(PANE_SOURCE))!),
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
  await loadComparison(page, "Side by side");
  await expectCardPane(page, "after", "Featured After");
  const light = paneFrame(comparisonSection(page, "component"), "after");
  const expired = generationOf((await light.getAttribute(PANE_SOURCE))!);
  allowBrowserError(
    responseFailure(changes.url, new URL(expired).pathname, 404),
  );
  const removal = await removeGeneration(page, expired, comparisonFrames(page));
  // Side by side compares the first shown frame, so hiding the Light frames
  // compares the variant's Dark frame, whose documents are new.
  await setFrames(page, { dark: true, light: false });
  await openPanelTab(page, "Changes");
  const dark = paneFrame(comparisonSection(page, "component", "dark"), "after");
  await expect(dark).toHaveAttribute(PANE_SOURCE, /\.desktop\.dark\.html$/u);
  await expectCardPane(page, "before", "Featured Before", "dark");
  await expectCardPane(page, "after", "Featured After", "dark");
  expect(generationOf((await dark.getAttribute(PANE_SOURCE))!)).not.toBe(
    expired,
  );
  expect(removal.renewed()).toBe(true);
  expect(removal.refused()).toEqual([]);
  expect(requests).toHaveLength(2);
  expect(requests[1]!.searchParams.get("path")).toBe(variant);
  expect(requests[1]!.searchParams.size).toBe(1);
  expect(failed).toEqual([]);
});

// On the canvas a removed screen's section holds the frames of both schemes,
// so a scheme change requests nothing; a viewport choice requests the other
// viewport's documents.
test("an expired preview is reacquired before changing the viewport", async ({
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
  const desktop = historicalFrame(page, "desktop").locator("iframe");
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

  // The address names Desktop, so the Mobile toggle starts off: turning it
  // on is the one viewport choice.
  await setFrames(page, { mobile: true });

  // The section's frame of the newly chosen viewport.
  const renewed = historicalFrame(page, "mobile").locator("iframe");
  await expect(renewed).toHaveAttribute(PANE_SOURCE, /\.mobile\.html$/u);
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
