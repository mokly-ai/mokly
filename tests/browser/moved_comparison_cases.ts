/** Moved comparisons, run against one host. */

import { expect, test, type Page } from "@playwright/test";

import { loadComparison } from "./comparison_actions.js";
import type {
  MovedChangesHost,
  MovedHostKind,
} from "./moved_changes_fixture.js";
import { ACTION, INVOICE, showDetails } from "./moved_rows.js";

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
 * Choose Side by side. Serve generates the comparison on demand; an export
 * and the viewer over it read the published one.
 */
async function sideBySide(page: Page, kind: MovedHostKind): Promise<void> {
  if (kind === "serve") return loadComparison(page, "Side by side");
  await page
    .getByRole("group", { name: "Comparison mode" })
    .getByRole("button", { name: "Side by side", exact: true })
    .click();
}

/** Register the comparison cases for the host `current` returns. */
export function movedComparisonCases(
  kind: MovedHostKind,
  current: () => MovedChangesHost,
): void {
  test("a moved screen compares with the version at its previous path in every mode", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await current().open(page, INVOICE);
    await expect(page.locator(".mbk-entry-status")).toHaveText("Changed");
    const modes = page.getByRole("group", { name: "Comparison mode" });
    await expect(
      modes.getByRole("button", { name: "Current" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator("iframe[data-mokly-comparison-frame]"),
    ).toHaveCount(0);
    await expect(
      page.frameLocator(".mbk-frame-mobile iframe").locator("#due"),
    ).toHaveText("Due on 14 March");
    const sides = [
      ["billing/invoice", INVOICE],
      [/Due in 14 days/u, /Due on 14 March/u],
    ] as const;
    await sideBySide(page, kind);
    await expectBothSides(page, ...sides);
    for (const mode of ["Overlay", "Difference"] as const) {
      await modes.getByRole("button", { name: mode, exact: true }).click();
      await expect(
        modes.getByRole("button", { name: mode, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expectBothSides(page, ...sides);
    }
    await modes.getByRole("button", { name: "Current", exact: true }).click();
    await expect(
      page.locator("iframe[data-mokly-comparison-frame]"),
    ).toHaveCount(0);
    await showDetails(page);
    await expect(page.locator("[data-workspace-evidence]")).toContainText(
      "The previous version is at billing/invoice, where it was before the move.",
    );
  });

  test("a moved component variant compares with its version at the previous path", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await current().open(page, `${ACTION}/iconic`);
    await sideBySide(page, kind);
    await expectBothSides(
      page,
      ["components/action/iconic", `${ACTION}/iconic`],
      [/>arrow</u, />chevron</u],
    );
  });
}
