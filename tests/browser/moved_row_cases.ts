/** Moved rows, their marks, and their Details, run against one host. */

import { expect, test } from "@playwright/test";

import type {
  MovedChangesHost,
  MovedHostKind,
} from "./moved_changes_fixture.js";
import {
  ACTION,
  INVOICE,
  consoleErrors,
  dot,
  expectMarks,
  row,
  showCatalogue,
  showDetails,
} from "./moved_rows.js";

const MOVED_ROWS = [
  [INVOICE, "Invoice"],
  [`${INVOICE}/overdue`, "Overdue"],
  ["account/billing/receipt", "Receipt"],
  ["account/billing/payment-terms", "Payment terms"],
  [ACTION, "Action"],
  [`${ACTION}/primary`, "Primary"],
  [`${ACTION}/ghost`, "Ghost"],
  [`${ACTION}/iconic`, "Iconic"],
  ["ui/icon", "Icon"],
  ["ui/icon/arrow", "Arrow"],
] as const;

/** Register the row and Details cases for the host `current` returns. */
export function movedRowCases(
  kind: MovedHostKind,
  current: () => MovedChangesHost,
): void {
  for (const width of kind === "viewer" ? [1280] : [390, 1280])
    test(`${width}px: Changes keeps one Moved row per paired entry, with no changed mark`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const errors = consoleErrors(page);
      await current().open(page, "home");
      await showCatalogue(page);
      await expect(row(page, INVOICE)).not.toContainText("Moved");
      for (const removed of [
        "billing/invoice/paid",
        `components/action/secondary`,
      ])
        await expect(row(page, removed)).toBeHidden();
      await page.click('[data-filter="changed"]');
      await expect(page.locator('[data-filter="changed"]')).toContainText("12");
      for (const [entry, title] of MOVED_ROWS) {
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
      await expect(row(page, "home")).toBeHidden();
      for (const previous of ["billing/", "components/"])
        await expect(
          page.locator(
            `nav.mbk-nav a[data-nav-row][data-entry-id^="${previous}"]`,
          ),
        ).toHaveCount(1);
      await page.click('[data-filter="all"]');
      await expect(row(page, INVOICE)).not.toContainText("Moved");
      expect(errors).toEqual([]);
    });

  test("All marks a moved row only when its entry changed beyond the move", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const errors = consoleErrors(page);
    for (const [entry, rows] of [
      [
        `${INVOICE}/overdue`,
        [
          [INVOICE, "Invoice", true],
          [`${INVOICE}/overdue`, "Overdue", false],
          ["account/billing/receipt", "Receipt", false],
          ["account/billing/payment-terms", "Payment terms", false],
        ],
      ],
      [
        `${ACTION}/primary`,
        [
          [ACTION, "Action", true],
          [`${ACTION}/primary`, "Primary", false],
          [`${ACTION}/ghost`, "Ghost", true],
          [`${ACTION}/iconic`, "Iconic", true],
        ],
      ],
      [
        "ui/icon/arrow",
        [
          ["ui/icon", "Icon", false],
          ["ui/icon/arrow", "Arrow", false],
        ],
      ],
    ] as const) {
      await current().open(page, entry);
      await expectMarks(page, rows);
    }
    await expect(row(page, ACTION)).not.toHaveAttribute("data-changed", /./u);
    await expect(row(page, ACTION)).toHaveAttribute(
      "data-changed-variants",
      "true",
    );
    expect(errors).toEqual([]);
  });

  test("Details name the path each moved entry came from", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const errors = consoleErrors(page);
    for (const [entry, previous, open] of [
      [INVOICE, "billing/invoice", "tab"],
      [`${INVOICE}/overdue`, "billing/invoice/overdue", "tab"],
      ["account/billing/payment-terms", "billing/payment-terms", "summary"],
      [`${ACTION}/ghost`, "components/action/ghost", "tab"],
    ] as const) {
      await current().open(page, entry);
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
    expect(errors).toEqual([]);
  });

  test("a pure move opens Unmodified and its comparison details name its previous path", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const errors = consoleErrors(page);
    await current().open(page, "account/billing/receipt");
    await expect(page.locator(".mbk-entry-status")).toHaveText("Unmodified");
    await expect(
      page.getByRole("group", { name: "Comparison mode" }),
    ).toHaveCount(0);
    await showDetails(page);
    const evidence = page.locator("[data-workspace-evidence]");
    await expect(evidence).toContainText(
      "The previous version is at billing/receipt, where it was before the move.",
    );
    await expect(evidence).toContainText("No changes to this screen.");
    await page.reload();
    await expect(evidence).toContainText("No changes to this screen.");
    expect(errors).toEqual([]);
  });

  test("a variant removed from a moved screen opens with links to that screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await current().open(page, "billing/invoice/paid");
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
