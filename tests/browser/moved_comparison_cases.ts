/** Moved comparisons, run against one host. */

import { expect, type Page } from "@playwright/test";

import { movedFixturePaths as moves } from "../helpers/moved_fixture_sources.js";

import type { test as baseTest } from "./browser_test.js";
import { modeButton } from "./comparison_ui.js";
import {
  INVOICE,
  PREVIOUS,
  showDetails,
  type MovedHost,
} from "./moved_rows.js";
import { loadComparison } from "./serve_comparison_ui.js";

/** The comparison panes for one side, named by the snapshot path they show. */
function panes(page: Page, side: "after" | "before", path: string) {
  return page.locator(
    `iframe[data-mokly-comparison-frame][data-mokly-preview-source*="/snapshots/${side}/mokly-generated/${path}/"]`,
  );
}

async function expectBothSides(
  page: Page,
  [previous, path]: readonly [string, string],
  [before, after]: readonly [RegExp, RegExp],
): Promise<void> {
  await expect(panes(page, "before", previous).first()).toBeAttached();
  await expect(panes(page, "after", path).first()).toBeAttached();
  await expect(panes(page, "before", path)).toHaveCount(0);
  await expect(panes(page, "before", previous).first()).toHaveAttribute(
    "srcdoc",
    before,
  );
  await expect(panes(page, "after", path).first()).toHaveAttribute(
    "srcdoc",
    after,
  );
}

/**
 * Choose Side by side. Serve captures the comparison on demand; a copy reads
 * its published generation.
 */
async function sideBySide(page: Page, host: MovedHost): Promise<void> {
  if (host.comparisons === "on demand")
    return loadComparison(page, "Side by side");
  await modeButton(page, "Side by side").click();
}

/**
 * Register the moved screen and moved component variant comparisons on
 * `host`, which `test` serves.
 */
export function registerMovedComparisonCases(
  test: typeof baseTest,
  host: MovedHost,
): void {
  test("a moved screen compares with the version at its previous path in every mode", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await host.open(page, INVOICE);
    await expect(page.locator(".mbk-entry-status")).toHaveText("Changed");
    await expect(modeButton(page, "Current")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.locator("iframe[data-mokly-comparison-frame]"),
    ).toHaveCount(0);
    await expect(
      page.frameLocator('[data-workspace-frame="mobile"]').locator("p"),
    ).toHaveText("Due on 14 March");
    const sides = [
      [`${PREVIOUS}/invoice`, INVOICE],
      [/Due in 14 days/u, /Due on 14 March/u],
    ] as const;
    await sideBySide(page, host);
    await expectBothSides(page, ...sides);
    for (const mode of ["Overlay", "Difference"] as const) {
      await modeButton(page, mode).click();
      await expect(modeButton(page, mode)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expectBothSides(page, ...sides);
    }
    await modeButton(page, "Current").click();
    await expect(
      page.locator("iframe[data-mokly-comparison-frame]"),
    ).toHaveCount(0);
    await showDetails(page);
    await expect(page.locator("[data-workspace-evidence]")).toContainText(
      `The previous version is at ${PREVIOUS}/invoice, where it was before the move.`,
    );
  });

  test("a moved component variant compares with its version at the previous path", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await host.open(page, moves.nestedMovedVariant);
    await sideBySide(page, host);
    await expectBothSides(
      page,
      [`${PREVIOUS}/action/iconic`, moves.nestedMovedVariant],
      [/>arrow</u, />chevron</u],
    );
  });
}
