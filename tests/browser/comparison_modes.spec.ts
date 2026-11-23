import { expect } from "@playwright/test";

import {
  comparisonSection,
  frameLabels,
  frameModes,
  paneFrame,
} from "./comparison_sections.js";
import { comparisonPaths, test } from "./comparison_test.js";
import {
  awaitRoutedDetail,
  chooseFilter,
  comparisonFrames,
  comparisonIndex,
  expectNoCompareModes,
  modeButton,
  navRow,
  outcomeLines,
  showMode,
  snapshotOf,
} from "./comparison_ui.js";
import { historicalFrame, previousVersionLabel } from "./previous_version.js";
import {
  canvasFrame,
  chooseScheme,
  chooseViewport,
  openCatalogueSheet,
  openPanelTab,
  setFrames,
} from "./workspace_actions.js";

test("Changes and screen browsing stay lazy until a diff is selected", async ({
  page,
}) => {
  const requests: string[] = [];
  const all: string[] = [];
  const failed: string[] = [];
  page.on("request", (request) => {
    all.push(request.url());
    if (request.url().includes("/mokly-viewer/diffs/"))
      requests.push(request.url());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseFilter(page, "changed");
  await chooseViewport(page, "mobile");
  await chooseScheme(page, "dark");
  await navRow(page, comparisonPaths.darkOnly).click();
  await expect(page.locator("#mb-main h2").first()).toHaveText("Dusk screen");
  await navRow(page, comparisonPaths.changed).click();
  await expect(page.locator("#mb-main h2").first()).toHaveText(
    "Changed screen",
  );
  expect(requests).toEqual([]);

  // Overlay compares each shown frame: Mobile · Light and Mobile · Dark.
  await showMode(page, "Overlay", 4);
  const dark = comparisonSection(page, "mobile", "dark");
  await expect(frameModes(dark)).toHaveAttribute(
    "data-compare-mode",
    "overlay",
  );
  await expect(paneFrame(dark, "before")).toHaveAttribute(
    "title",
    "Before — mobile — dark",
  );
  await expect(page.locator('button[data-filter="changed"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(requests.some((url) => url.includes("/snapshots/"))).toBe(true);
  await showMode(page, "Side by side", 2);
  await showMode(page, "Difference", 4);
  // Static Refresh reads the same immutable generation again.
  const sources = () =>
    comparisonFrames(page).evaluateAll((frames) =>
      frames.map((frame) => frame.getAttribute("data-mokly-preview-source")),
    );
  const loaded = await sources();
  await page.getByRole("button", { name: "Refresh comparison" }).click();
  await expect(comparisonFrames(page)).toHaveCount(4);
  await expect.poll(sources).toEqual(loaded);
  // Current shows the screen's own frames again.
  await modeButton(page, "Current").click();
  for (const scheme of ["light", "dark"] as const)
    await expect(page.locator(canvasFrame("mobile", scheme))).toBeVisible();
  await expect(comparisonFrames(page)).toHaveCount(0);
  // A static host has no event stream, and nothing failed to load.
  expect(all.some((url) => url.includes("/mokly-viewer/events"))).toBe(false);
  expect(failed).toEqual([]);
});

test("unchanged views omit comparisons while changed views retain all modes", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.darkOnly}/`);
  // The Light frames alone show the views that did not change.
  await setFrames(page, { light: true, dark: false });
  await expect(page.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
  await awaitRoutedDetail(page, comparisonPaths.darkOnly);
  await expectNoCompareModes(page);
  // The Dark frames alone show the views that changed.
  await setFrames(page, { dark: true, light: false });
  await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
  await chooseViewport(page, "desktop");
  // Every shown frame compares, here Desktop · Dark alone.
  await showMode(page, "Overlay", 2);
  await showMode(page, "Difference", 2);
  const dark = comparisonSection(page, "desktop", "dark");
  await expect(frameModes(dark)).toHaveAttribute(
    "data-compare-mode",
    "difference",
  );
  await showMode(page, "Side by side", 2);
  await expect(frameLabels(dark)).toHaveText([
    /^Before Desktop · Dark/u,
    /^Current Desktop · Dark/u,
  ]);
  // Both viewports bring their frames into the compare, which the band
  // lists, while Side by side still compares one frame.
  await chooseViewport(page, "both");
  await openPanelTab(page, "Changes");
  await expect(outcomeLines(page)).toHaveText([
    /^Desktop · Dark · /u,
    /^Mobile · Dark · /u,
  ]);
  await expect(comparisonFrames(page)).toHaveCount(2);
  await navRow(page, comparisonPaths.unchanged).click();
  await expect(page.locator("#mb-main h2").first()).toHaveText("Stable screen");
  await awaitRoutedDetail(page, comparisonPaths.unchanged);
  await expectNoCompareModes(page);
  await expect(comparisonFrames(page)).toHaveCount(0);
});

test("added and removed screens stay current without comparison controls", async ({
  page,
  request,
  baseURL,
}) => {
  const index = await comparisonIndex(request, baseURL);
  await page.goto(`/view/${comparisonPaths.added}/`);
  await chooseFilter(page, "changed");
  await expect(navRow(page, comparisonPaths.added)).toBeVisible();
  await expect(page.locator("[data-workspace-status]")).toHaveText("Added");
  await awaitRoutedDetail(page, comparisonPaths.added);
  await expectNoCompareModes(page);
  await expect(
    page
      .frameLocator(canvasFrame("desktop"))
      .getByRole("heading", { name: "Added screen" }),
  ).toBeVisible();

  const snapshot = snapshotOf(index, comparisonPaths.removedScreen);
  await page.goto(
    `/view/${comparisonPaths.removedScreen}/?snapshot=${snapshot}`,
  );
  await chooseFilter(page, "changed");
  await expect(navRow(page, comparisonPaths.removedScreen)).toBeVisible();
  await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
  await awaitRoutedDetail(page, comparisonPaths.removedScreen);
  // No mode control exists, and no current frame shows.
  await expect(page.locator("[data-diff-mode]")).toHaveCount(0);
  await expect(page.locator(canvasFrame("desktop"))).toHaveCount(0);
  await expect(previousVersionLabel(page)).toHaveText(
    "Showing previous version",
  );
  await expect(
    historicalFrame(page, "desktop")
      .locator("iframe")
      .contentFrame()
      .getByRole("heading", { name: "Historical screen" }),
  ).toBeVisible();
});

test("snapshot panes keep marked links inert", async ({ page }) => {
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseViewport(page, "desktop");
  await showMode(page, "Side by side", 2);
  const iframe = paneFrame(comparisonSection(page, "desktop"), "before");
  const source = await iframe.getAttribute("data-mokly-preview-source");
  const before = page.url();
  await iframe.contentFrame().locator("#snapshot-link").click();
  await expect(page).toHaveURL(before);
  await expect(page.locator("#mb-main h2").first()).toHaveText(
    "Changed screen",
  );
  await expect(iframe.contentFrame().locator("h1")).toHaveText("Before screen");
  await expect(iframe).toHaveAttribute("data-mokly-preview-source", source!);
  expect(
    await iframe.evaluate(
      (frame: HTMLIFrameElement) => frame.contentDocument?.URL,
    ),
  ).toBe("about:srcdoc");
});

test("narrow diffs fit the shell and retain the catalogue drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseViewport(page, "mobile");
  // The compact layout shows one frame, Mobile · Light.
  await showMode(page, "Overlay", 2);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await openCatalogueSheet(page);
  await expect(navRow(page, comparisonPaths.unchanged)).toBeVisible();
  await navRow(page, comparisonPaths.unchanged).click();
  await expect(page.locator("#mb-main h2").first()).toHaveText("Stable screen");
});

test("mode switches keep frames and focus and cannot expand one side alone", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseViewport(page, "desktop");
  await showMode(page, "Overlay", 4);
  const desktop = comparisonSection(page, "desktop");
  const frame = await paneFrame(desktop, "before").elementHandle();
  expect(frame).not.toBeNull();
  // A compared frame is bare: it holds no control, so one version cannot be
  // expanded alone.
  await expect(desktop.getByRole("button")).toHaveCount(0);
  await modeButton(page, "Difference").click();
  await expect(modeButton(page, "Difference")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await frame?.evaluate((node) => node.isConnected)).toBe(true);
  await frame?.dispose();
  // Keyboard activation keeps focus on the pressed mode.
  for (const name of [
    "Side by side",
    "Overlay",
    "Difference",
    "Swipe",
    "Current",
  ] as const) {
    await modeButton(page, name).focus();
    await page.keyboard.press("Enter");
    await expect(modeButton(page, name)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(modeButton(page, name)).toBeFocused();
  }
});
