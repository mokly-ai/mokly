/**
 * Comparison eligibility in the copied comparison output, under the
 * comparison modes and removed previews contracts. An added screen and a
 * removed screen have no comparison; a removed screen opens its previous
 * version under its snapshot address, also from an affected-screen link and
 * from a legacy comparison URL. A light-only screen under Dark has its Light
 * frames alone, which compare their light versions, and its Frames filter
 * names it Light only.
 */

import { expect, type Page } from "@playwright/test";

import { expectNoComparison } from "./comparison_absence.js";
import { comparisonSection, paneFrame } from "./comparison_sections.js";
import { comparisonPaths, test } from "./comparison_test.js";
import {
  awaitRoutedDetail,
  comparisonFrames,
  comparisonIndex,
  expectNoCompareModes,
  outcomeLines,
  showMode,
  snapshotOf,
} from "./comparison_ui.js";
import {
  historicalFrame,
  previousVersionLabel,
  PREVIOUS,
} from "./previous_version.js";
import {
  canvasFrame,
  chooseScheme,
  chooseViewport,
  openInspectFold,
} from "./workspace_actions.js";

/** The stage shows a removed screen's previous version and no comparison. */
async function expectRemovedPrevious(
  page: Page,
  path: string,
  heading: string,
) {
  await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
  await awaitRoutedDetail(page, path);
  await expectNoComparison(page);
  await expect(previousVersionLabel(page)).toHaveText(
    "Showing previous version",
  );
  await expect(
    page.frameLocator(`${PREVIOUS} iframe`).first().locator("h1"),
  ).toHaveText(heading);
}

test("added and removed screens stay current while a light-only comparison keeps its light versions", async ({
  page,
  request,
  baseURL,
}) => {
  const index = await comparisonIndex(request, baseURL);
  await page.goto(`/view/${comparisonPaths.added}/`);
  await chooseViewport(page, "mobile");
  // The added screen stays current: no snapshot and no comparison.
  await expect
    .poll(() => {
      const address = new URL(page.url());
      return [
        address.pathname,
        address.searchParams.has("snapshot"),
        address.searchParams.has("comparison"),
      ];
    })
    .toEqual([`/view/${comparisonPaths.added}/`, false, false]);
  await expect(page.locator("[data-workspace-status]")).toHaveText("Added");
  await awaitRoutedDetail(page, comparisonPaths.added);
  await expectNoCompareModes(page);
  await expect(
    page.frameLocator(canvasFrame("mobile")).locator("h1"),
  ).toHaveText("Added screen");

  await page.goto(`/view/${comparisonPaths.removedScreen}/`);
  await chooseViewport(page, "mobile");
  await expect(page).toHaveURL(
    new RegExp(
      `/view/${comparisonPaths.removedScreen}/\\?.*snapshot=${snapshotOf(index, comparisonPaths.removedScreen)}`,
      "u",
    ),
  );
  await expectRemovedPrevious(
    page,
    comparisonPaths.removedScreen,
    "Historical screen",
  );
  // The viewport choice keeps the Mobile column of the section.
  await expect(historicalFrame(page, "mobile").locator("iframe")).toHaveCount(
    1,
  );
  await expect(historicalFrame(page, "desktop")).toHaveCount(0);

  await page.goto(`/view/${comparisonPaths.lightOnly}/`);
  await chooseScheme(page, "dark");
  await expect(page.locator('[data-view-changed="scheme"]')).toBeHidden();
  // The light-only screen has its Light frames alone, and the Frames
  // filter's Dark toggle names it Light only.
  const dark = page.locator('[data-frames-toggle="dark"]');
  await expect(dark).toBeDisabled();
  await expect(page.locator("label", { has: dark })).toContainText(
    "Light only",
  );
  await showMode(page, "Overlay", 4);
  await expect(outcomeLines(page)).toHaveText([
    "Desktop · Light · Screen changed",
    "Mobile · Light · Screen changed",
  ]);
  for (const frame of await comparisonFrames(page).all()) {
    await expect(frame).toHaveAttribute(
      "data-mokly-preview-source",
      /\/index\.(?:mobile|desktop)\.html$/u,
    );
    await expect(frame).toHaveCSS("color-scheme", "light");
  }
  for (const [side, heading] of [
    ["before", "Daylight Before"],
    ["after", "Daylight After"],
  ] as const)
    await expect(
      paneFrame(comparisonSection(page, "desktop"), side)
        .contentFrame()
        .locator("h1"),
    ).toHaveText(heading);
});

test("removed affected-screen links and legacy comparison URLs stay current", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.component}/`);
  const usage = await openInspectFold(page, "usage");
  const removed = usage
    .locator('[data-usage-section="affected"]')
    .getByRole("link", { name: "Former screen · Removed", exact: true });
  await expect(removed).not.toHaveAttribute("href", /comparison=side/u);
  await removed.click();
  await expect(page).toHaveURL(
    new RegExp(`/view/${comparisonPaths.removedLightOnly}/\\?`, "u"),
  );
  await expectRemovedPrevious(
    page,
    comparisonPaths.removedLightOnly,
    "Former screen",
  );

  await page.goto(`/view/${comparisonPaths.removedLightOnly}/?comparison=side`);
  await expectRemovedPrevious(
    page,
    comparisonPaths.removedLightOnly,
    "Former screen",
  );
});
