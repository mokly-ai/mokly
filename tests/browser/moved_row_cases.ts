/** Moved rows, their marks, and their Details, run against one host. */

import { expect } from "@playwright/test";

import { comparisonPaths } from "../helpers/comparison_catalogue.js";
import { movedFixturePaths as moves } from "../helpers/moved_fixture_sources.js";

import { test as baseTest } from "./browser_test.js";
import { chooseFilter } from "./comparison_ui.js";
import {
  ACTION,
  dot,
  expectMarks,
  INVOICE,
  movedIndex,
  PREVIOUS,
  row,
  showCatalogue,
  showDetails,
} from "./moved_rows.js";

/** Register the row and Details cases on the host that `test` supplies. */
export function registerMovedRowCases(test = baseTest): void {
  for (const width of [390, 1280])
    test(`${width}px: Changes keeps one Moved row per paired entry, with no changed mark`, async ({
      page,
      request,
      baseURL,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const { count, moved } = await movedIndex(request, baseURL);
      expect(moved.map(([path]) => path)).toEqual(
        expect.arrayContaining([INVOICE, ACTION, moves.pureMovedScreen]),
      );
      await page.goto(`/view/${comparisonPaths.unchanged}/`);
      await showCatalogue(page);
      await expect(row(page, INVOICE)).not.toContainText("Moved");
      for (const removed of [
        moves.removedInvoiceVariant,
        moves.removedActionVariant,
      ])
        await expect(row(page, removed)).toBeHidden();
      await chooseFilter(page, "changed");
      await expect(page.locator('[data-filter="changed"]')).toContainText(
        String(count),
      );
      for (const [entry, title] of moved) {
        await expect(row(page, entry)).toHaveAccessibleName(`${title} · Moved`);
        expect(await dot(page, entry)).toBe("none");
      }
      for (const [parent, labels] of [
        [INVOICE, ["Overdue · Moved", "Paid · Removed"]],
        [
          ACTION,
          [
            "Primary · Moved",
            "Ghost · Moved",
            "Iconic · Moved",
            "Secondary · Removed",
          ],
        ],
      ] as const)
        await expect(
          page
            .locator(`[data-nav-disclosure="variants:${parent}"]`)
            .locator("a[data-nav-row]"),
        ).toHaveText(labels, { useInnerText: true });
      await expect(row(page, comparisonPaths.unchanged)).toBeHidden();
      // A paired base path keeps no row; only its removed variants remain.
      await expect(
        page.locator(
          `nav.mbk-nav a[data-nav-row][data-entry-id^="${PREVIOUS}/"]`,
        ),
      ).toHaveCount(2);
      await chooseFilter(page, "all");
      await expect(row(page, INVOICE)).not.toContainText("Moved");
    });

  test("All marks a moved row only when its entry changed beyond the move", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const [entry, rows] of [
      [
        moves.keptInvoiceVariant,
        [
          [INVOICE, "Invoice", true],
          [moves.keptInvoiceVariant, "Overdue", false],
          [moves.pureMovedScreen, "Receipt", false],
          [moves.movedPage, "Payment guide", false],
        ],
      ],
      [
        moves.unchangedMovedVariant,
        [
          [ACTION, "Action", true],
          [moves.unchangedMovedVariant, "Primary", false],
          [moves.metadataMovedVariant, "Ghost", true],
          [moves.nestedMovedVariant, "Iconic", true],
        ],
      ],
    ] as const) {
      await page.goto(`/view/${entry}/`);
      await expectMarks(page, rows);
    }
    await expect(row(page, ACTION)).not.toHaveAttribute("data-changed", /./u);
    await expect(row(page, ACTION)).toHaveAttribute(
      "data-changed-variants",
      "true",
    );
  });

  test("Details name the path each moved entry came from", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const [entry, previous, open] of [
      [INVOICE, `${PREVIOUS}/invoice`, "tab"],
      [moves.keptInvoiceVariant, `${PREVIOUS}/invoice/overdue`, "tab"],
      [moves.movedPage, `${PREVIOUS}/guide`, "summary"],
      [moves.metadataMovedVariant, `${PREVIOUS}/action/ghost`, "tab"],
    ] as const) {
      await page.goto(`/view/${entry}/`);
      if (open === "tab") await showDetails(page);
      else await page.locator("[data-mokly-details] summary").click();
      const moved = page.locator(".mbk-meta-row", {
        has: page.locator(".mbk-meta-k", { hasText: "Moved from" }),
      });
      await expect(moved).toHaveText(`Moved from${previous}`);
      await expect(
        moved.locator("xpath=preceding-sibling::*[1]"),
      ).toContainText("Source");
    }
  });

  test("a pure move opens Unmodified and its comparison details name its previous path", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/view/${moves.pureMovedScreen}/`);
    await expect(page.locator(".mbk-entry-status")).toHaveText("Unmodified");
    await expect(
      page.getByRole("group", { name: "Comparison mode" }),
    ).toHaveCount(0);
    await showDetails(page);
    const evidence = page.locator("[data-workspace-evidence]");
    await expect(evidence).toContainText(
      `The previous version is at ${PREVIOUS}/receipt, where it was before the move.`,
    );
    await expect(evidence).toContainText("No changes to this screen.");
    await page.reload();
    await expect(evidence).toContainText("No changes to this screen.");
  });

  test("a variant removed from a moved screen opens with links to that screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/view/${moves.removedInvoiceVariant}/`);
    await expect(page.locator(".mbk-previous")).toHaveText(
      "Showing previous version",
    );
    const crumb = page
      .getByLabel("Catalogue location")
      .getByRole("link", { name: "Invoice", exact: true });
    await expect(crumb).toHaveAttribute("href", `/view/${INVOICE}/`);
    await showDetails(page);
    const parent = page
      .locator(".mbk-meta-row", { hasText: "Variant of" })
      .getByRole("link", { name: "Invoice" });
    await expect(parent).toHaveAttribute("href", `/view/${INVOICE}/`);
  });
}
