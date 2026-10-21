/**
 * Comparison eligibility in the copied comparison output, under the
 * comparison modes and removed previews contracts. An added screen and a
 * removed screen have no comparison; a removed screen opens its previous
 * version under its snapshot address, also from an affected-screen link and
 * from a legacy comparison URL. A light-only screen under Dark compares its
 * light versions and names them Light only.
 */

import { expect, type Page } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import {
  awaitRoutedDetail,
  comparisonIndex,
  modeButton,
  snapshotOf,
} from "./comparison_ui.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

const PREVIEW = "[data-mokly-preview]";

/** The stage shows a removed screen's previous version and no comparison. */
async function expectRemovedPrevious(
  page: Page,
  path: string,
  heading: string,
) {
  await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
  await awaitRoutedDetail(page, path);
  await expect(page.locator(".mbk-diff-toolbar")).toHaveCount(0);
  await expect(
    page.locator("[data-current-screen], [data-diff-stage]"),
  ).toHaveCount(0);
  await expect(page.locator(".mbk-previous")).toHaveText(
    "Showing previous version",
  );
  await expect(
    page.frameLocator(`${PREVIEW} iframe`).first().locator("h1"),
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
  await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
  await expect(
    page.frameLocator('iframe[data-workspace-frame="mobile"]').locator("h1"),
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
  await expect(page.locator(`${PREVIEW} .mbk-frame-mobile iframe`)).toHaveCount(
    1,
  );

  await page.goto(`/view/${comparisonPaths.lightOnly}/`);
  await chooseScheme(page, "dark");
  await expect(page.locator('[data-view-changed="scheme"]')).toBeHidden();
  await modeButton(page, "Overlay").click();
  await expect(page.locator("[data-diff-viewport] h3")).toHaveText([
    /· Light only$/u,
    /· Light only$/u,
  ]);
  const frames = page.locator("[data-diff-stage] iframe");
  await expect(frames).toHaveCount(4);
  for (const frame of await frames.all()) {
    await expect(frame).toHaveAttribute(
      "data-mokly-preview-source",
      /\/index\.(?:mobile|desktop)\.html$/u,
    );
    await expect(frame).toHaveCSS("color-scheme", "light");
  }
  for (const [title, heading] of [
    ["Before", "Daylight Before"],
    ["Current", "Daylight After"],
  ] as const)
    await expect(
      page
        .locator(`[data-diff-stage] iframe[title^="${title} — desktop"]`)
        .contentFrame()
        .locator("h1"),
    ).toHaveText(heading);
});

test("removed affected-screen links and legacy comparison URLs stay current", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.component}/`);
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  const removed = page
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
