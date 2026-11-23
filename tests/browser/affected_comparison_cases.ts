/**
 * User decision 82 B on each host: a screen or component that only changed
 * components affect offers its comparison while it stays out of Changes and
 * shows Unmodified, an Affected screens link opens that comparison on the
 * Changes tab, and an ordinary unmodified entry still offers none. In the
 * copied comparison output, Consumer screen and Toolbar use Card, whose
 * shared stylesheet changes; Stable screen and Plain use no changed
 * component. The compare modes and the comparison details stand in the right
 * panel's Changes tab, and the canvas compares while that tab is selected.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { comparisonPaths } from "../helpers/comparison_catalogue.js";

import type { test as baseTest } from "./browser_test.js";
import {
  chooseFilter,
  comparisonFrames,
  modeButton,
  navRow,
} from "./comparison_ui.js";
import { openPanelTab } from "./panel_actions.js";
import { awaitSelectedComparison } from "./serve_comparison_ui.js";

/** Where the catalogue comes from: Serve, or a static build. */
export type ComparisonHost = "serve" | "static";

/** The outcome line of each of Consumer screen's frames, in the canvas's order. */
const SCREEN_LINES = [
  "Desktop · Light · Components this screen uses changed",
  "Mobile · Light · Components this screen uses changed",
  "Desktop · Dark · Components this screen uses changed",
  "Mobile · Dark · Components this screen uses changed",
];

/** The outcome line of each frame of Toolbar's one row. */
const VARIANT_LINES = [
  "Toolbar · Light · Components this variant uses changed",
  "Toolbar · Dark · Components this variant uses changed",
];

/** Run an action that starts a comparison; Serve captures it on demand. */
async function comparing(
  page: Page,
  host: ComparisonHost,
  action: () => Promise<void>,
): Promise<void> {
  if (host === "serve") await awaitSelectedComparison(page, action);
  else await action();
}

/**
 * Wait until the shell shows `path` and has applied its entry detail: the
 * Path row of Inspect names the routed entry in the render that starts the
 * detail load, and the stage and the Usage fold show that load until it
 * settles. The detail can still make an affected-only entry eligible, so a
 * check that an entry offers no comparison waits for this first.
 */
async function awaitRoutedEntry(page: Page, path: string): Promise<void> {
  await expect(page.locator("[data-inspect-path] code")).toHaveText(path);
  await expect(
    page.locator('[data-mokly-stage][aria-busy="true"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-inspect-section="usage"] p[role="status"]'),
  ).toHaveCount(0);
}

/** The right panel's Changes tab. */
function changesTab(page: Page): Locator {
  return page.getByRole("tab", { name: "Changes", exact: true });
}

/** The tiles of the compare modes. */
function compareModes(page: Page): Locator {
  return page.getByRole("group", { name: "Comparison mode" });
}

/** An Unmodified entry whose Changes tab offers the compare modes. */
async function expectModesOffered(page: Page, path: string): Promise<void> {
  await awaitRoutedEntry(page, path);
  await expect(page.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
  await openPanelTab(page, "Changes");
  await expect(compareModes(page)).toBeVisible();
}

/**
 * An Unmodified entry without a comparison: it has no Comparison mode group,
 * also in its Changes tab when it has one. A role locator skips the tab that
 * is not selected, so the Changes tab opens first.
 */
async function expectNoModes(page: Page, path: string): Promise<void> {
  await awaitRoutedEntry(page, path);
  await expect(page.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
  // The routed detail has settled, so the panel's tabs are final.
  if (await changesTab(page).count()) await openPanelTab(page, "Changes");
  await expect(compareModes(page)).toHaveCount(0);
}

/**
 * Side by side: the outcome line of every compared frame in the Changes tab's
 * details, and the two versions of the one frame that it compares.
 */
async function expectSideBySide(
  page: Page,
  lines: readonly string[],
): Promise<void> {
  await expect(modeButton(page, "Side by side")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page
      .getByRole("tabpanel", { name: "Changes" })
      .getByRole("list", { name: "Compared frames" })
      .getByRole("listitem"),
  ).toHaveText(lines);
  await expect(comparisonFrames(page)).toHaveCount(2);
}

/** Register the affected-only comparison journeys for one host. */
export function registerAffectedComparisons(
  test: typeof baseTest,
  host: ComparisonHost,
) {
  test("an affected-only screen and component offer their comparison, and an ordinary unmodified entry offers none", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const [path, lines] of [
      [comparisonPaths.consumer, SCREEN_LINES],
      [comparisonPaths.consumingComponent, VARIANT_LINES],
    ] as const) {
      await page.goto(`/view/${path}/`);
      await expectModesOffered(page, path);
      await comparing(page, host, () =>
        modeButton(page, "Side by side").click(),
      );
      await expectSideBySide(page, lines);
      // The comparison keeps the entry Unmodified and out of Changes.
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Unmodified",
      );
      await chooseFilter(page, "changed");
      await expect(navRow(page, path)).toBeHidden();
      await expect(navRow(page, comparisonPaths.component)).toBeVisible();
    }
    for (const path of [
      comparisonPaths.unchanged,
      comparisonPaths.plainComponent,
    ]) {
      await page.goto(`/view/${path}/`);
      await expectNoModes(page, path);
    }
  });

  test("an Affected screens link opens the consumer's comparison", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/view/${comparisonPaths.component}/`);
    // Usage is a fold of Inspect, which a full page load selects.
    const usage = page.locator('[data-inspect-section="usage"]');
    await usage.locator("summary").click();
    await expect(usage).toHaveAttribute("open", "");
    const link = usage
      .locator('[data-usage-section="affected"]')
      .getByRole("link", { name: "Consumer screen", exact: true });
    await expect(link).toHaveAttribute("href", /[?&]comparison=side(?:&|$)/u);
    await comparing(page, host, () => link.click());
    await expect(page).toHaveURL(
      new RegExp(`/view/${comparisonPaths.consumer}/\\?`, "u"),
    );
    // The shell honours the link's comparison intent: before any click on a
    // tab, Changes is selected, Side by side is shown, and the canvas
    // compares the two versions of one frame.
    await expect(changesTab(page)).toHaveAttribute("aria-selected", "true");
    await expect(modeButton(page, "Side by side")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(comparisonFrames(page)).toHaveCount(2);
    await expectModesOffered(page, comparisonPaths.consumer);
    // The canvas keeps every frame through the in-shell navigation, so each
    // of the consumer's frames has its outcome line.
    await expectSideBySide(page, SCREEN_LINES);
    await chooseFilter(page, "changed");
    await expect(navRow(page, comparisonPaths.consumer)).toBeHidden();
  });
}
