/**
 * User decision 82 B on each host: a screen or component that only changed
 * components affect offers its comparison while it stays out of Changes and
 * shows Unmodified, an Affected screens link opens that comparison, and an
 * ordinary unmodified entry still offers none. In the copied comparison
 * output, Consumer screen and Toolbar use Card, whose shared stylesheet
 * changes; Stable screen and Plain use no changed component.
 */

import { expect, type Page } from "@playwright/test";

import { comparisonPaths } from "../helpers/comparison_catalogue.js";

import type { test as baseTest } from "./browser_test.js";
import { rowOutcomes, screenOutcomes } from "./comparison_outcomes.js";
import {
  awaitRoutedDetail,
  chooseFilter,
  chooseMode,
  comparisonFrames,
  expectNoCompareModes,
  modeButton,
  navRow,
  outcomeLines,
} from "./comparison_ui.js";
import { awaitSelectedComparison } from "./serve_comparison_ui.js";
import { openInspectFold, openPanelTab } from "./workspace_actions.js";

/** Where the catalogue comes from: Serve, or a static build. */
export type ComparisonHost = "serve" | "static";

const SCREEN_HEADING = "Components this screen uses changed";
const VARIANT_HEADING = "Components this variant uses changed";

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
 * The shown status, and whether the Changes tab's band offers the compare
 * modes; an entry without a comparison shows no band.
 */
async function expectBand(
  page: Page,
  path: string,
  offered: boolean,
): Promise<void> {
  await awaitRoutedDetail(page, path);
  await expect(page.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
  if (!offered) return expectNoCompareModes(page);
  await openPanelTab(page, "Changes");
  await expect(
    page.getByRole("group", { name: "Comparison mode" }),
  ).toBeVisible();
}

/**
 * Side by side: the outcome line of every compared frame, and the two
 * versions of the one frame that it compares.
 */
async function expectSideBySide(
  page: Page,
  lines: readonly string[],
): Promise<void> {
  await expect(modeButton(page, "Side by side")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(outcomeLines(page)).toHaveText(lines);
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
      [comparisonPaths.consumer, screenOutcomes(SCREEN_HEADING)],
      [
        comparisonPaths.consumingComponent,
        rowOutcomes("Toolbar", VARIANT_HEADING),
      ],
    ] as const) {
      await page.goto(`/view/${path}/`);
      await expectBand(page, path, true);
      await comparing(page, host, () => chooseMode(page, "Side by side"));
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
      await expectBand(page, path, false);
    }
  });

  test("an Affected screens link opens the consumer's comparison", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/view/${comparisonPaths.component}/`);
    const link = (await openInspectFold(page, "usage"))
      .locator('[data-usage-section="affected"]')
      .getByRole("link", { name: "Consumer screen", exact: true });
    await expect(link).toHaveAttribute("href", /[?&]comparison=side(?:&|$)/u);
    await comparing(page, host, () => link.click());
    await expect(page).toHaveURL(
      new RegExp(`/view/${comparisonPaths.consumer}/\\?`, "u"),
    );
    await expectBand(page, comparisonPaths.consumer, true);
    // The canvas keeps every frame through the in-shell navigation, so
    // each of the consumer's frames compares.
    await expectSideBySide(page, screenOutcomes(SCREEN_HEADING));
    await chooseFilter(page, "changed");
    await expect(navRow(page, comparisonPaths.consumer)).toBeHidden();
  });
}
