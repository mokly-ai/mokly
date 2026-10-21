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
import { chooseFilter, modeButton, navRow } from "./comparison_ui.js";
import { awaitSelectedComparison } from "./serve_comparison_ui.js";

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

/** The shown status, and whether the comparison band offers its modes. */
async function expectBand(page: Page, offered: boolean): Promise<void> {
  await expect(page.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
  if (offered) await expect(page.locator(".mbk-diff-toolbar")).toBeVisible();
  else await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
}

/** Side by side of every shown view: each heading, and both versions. */
async function expectSideBySide(
  page: Page,
  headings: readonly string[],
): Promise<void> {
  await expect(modeButton(page, "Side by side")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("[data-diff-viewport] > h3")).toHaveText(headings);
  await expect(
    page.locator("[data-diff-stage] iframe[data-mokly-comparison-frame]"),
  ).toHaveCount(headings.length * 2);
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
    for (const [path, heading] of [
      [comparisonPaths.consumer, SCREEN_HEADING],
      [comparisonPaths.consumingComponent, VARIANT_HEADING],
    ] as const) {
      await page.goto(`/view/${path}/`);
      await expectBand(page, true);
      await comparing(page, host, () =>
        modeButton(page, "Side by side").click(),
      );
      await expectSideBySide(page, [
        `Mobile · ${heading}`,
        `Desktop · ${heading}`,
      ]);
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
      await expectBand(page, false);
    }
  });

  test("an Affected screens link opens the consumer's comparison", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/view/${comparisonPaths.component}/`);
    await page.getByRole("tab", { name: "Usage", exact: true }).click();
    const link = page
      .locator('[data-usage-section="affected"]')
      .getByRole("link", { name: "Consumer screen", exact: true });
    await expect(link).toHaveAttribute("href", /[?&]comparison=side(?:&|$)/u);
    await comparing(page, host, () => link.click());
    await expect(page).toHaveURL(
      new RegExp(`/view/${comparisonPaths.consumer}/\\?`, "u"),
    );
    await expectBand(page, true);
    // The link names the consumer's first affected view: mobile, light.
    await expectSideBySide(page, [`Mobile · ${SCREEN_HEADING}`]);
    await chooseFilter(page, "changed");
    await expect(navRow(page, comparisonPaths.consumer)).toBeHidden();
  });
}
