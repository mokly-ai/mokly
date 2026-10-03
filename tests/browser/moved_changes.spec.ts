import { expect, test, type Page } from "@playwright/test";

import {
  startMovedChanges,
  type MovedChangesHost,
} from "./moved_changes_fixture.js";

let served: MovedChangesHost;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  served = await startMovedChanges();
});

test.afterAll(async () => {
  if (served) await served.close();
});

const INVOICE = "account/billing/invoice";

function row(page: Page, entry: string) {
  return page.locator(`nav.mbk-nav a[data-nav-row][data-entry-id="${entry}"]`);
}

/** The trailing changed dot the stylesheet draws, or `none` when unmarked. */
function dot(page: Page, entry: string) {
  return row(page, entry).evaluate(
    (element) => getComputedStyle(element, "::after").content,
  );
}

/** Console errors other than the sandboxed previews' blocked scripts. */
function consoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !/sandboxed/u.test(message.text()))
      errors.push(message.text());
  });
  return errors;
}

for (const width of [390, 1280])
  test(`${width}px: Changes keeps one Moved row per paired entry, with no changed mark`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = consoleErrors(page);
    await page.goto(`${served.url}/view/home/`);
    const menu = page.locator("[data-mokly-menu]");
    if (await menu.isVisible()) await menu.click();
    await expect(row(page, INVOICE)).not.toContainText("Moved");
    await expect(row(page, "billing/invoice/paid")).toBeHidden();
    await page.click('[data-filter="changed"]');
    await expect(page.locator('[data-filter="changed"]')).toContainText("5");
    for (const [entry, label] of [
      [INVOICE, "Invoice · Moved"],
      [`${INVOICE}/overdue`, "Overdue · Moved"],
      ["account/billing/receipt", "Receipt · Moved"],
      ["account/billing/payment-terms", "Payment terms · Moved"],
    ] as const) {
      await expect(row(page, entry)).toHaveAccessibleName(label);
      expect(await dot(page, entry)).toBe("none");
    }
    const list = page.locator(`[data-nav-disclosure="variants:${INVOICE}"]`);
    await expect(list.locator("a[data-nav-row]")).toHaveText(
      ["Overdue · Moved", "Paid · Removed"],
      { useInnerText: true },
    );
    await expect(row(page, "home")).toBeHidden();
    await expect(
      page.locator('nav.mbk-nav a[data-nav-row][data-entry-id^="billing/"]'),
    ).toHaveCount(1);
    await page.click('[data-filter="all"]');
    await expect(row(page, INVOICE)).not.toContainText("Moved");
    expect(errors).toEqual([]);
  });

test("Details name the path each moved entry came from", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const errors = consoleErrors(page);
  for (const [entry, previous, open] of [
    [INVOICE, "billing/invoice", "tab"],
    [`${INVOICE}/overdue`, "billing/invoice/overdue", "tab"],
    ["account/billing/payment-terms", "billing/payment-terms", "summary"],
  ] as const) {
    await page.goto(`${served.url}/view/${entry}/`);
    if (open === "tab")
      await page.getByRole("tab", { name: "Details", exact: true }).click();
    else await page.locator("[data-mokly-details] summary").click();
    const moved = page.locator(".mbk-meta-row", {
      has: page.locator(".mbk-meta-k", { hasText: "Moved from" }),
    });
    await expect(moved).toHaveText(`Moved from${previous}`);
    await expect(moved.locator("xpath=preceding-sibling::*[1]")).toContainText(
      "Source",
    );
  }
  expect(errors).toEqual([]);
});

test("a pure move opens Unmodified and its comparison details name its previous path", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const errors = consoleErrors(page);
  await page.goto(`${served.url}/view/account/billing/receipt/`);
  await expect(page.locator(".mbk-entry-status")).toHaveText("Unmodified");
  await expect(
    page.getByRole("group", { name: "Comparison mode" }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(page.locator("[data-workspace-evidence]")).toContainText(
    "The previous version is at billing/receipt, where it was before the move.",
  );
  await expect(page.locator("[data-workspace-evidence]")).toContainText(
    "No changes to this screen.",
  );
  await page.reload();
  await expect(page.locator("[data-workspace-evidence]")).toContainText(
    "No changes to this screen.",
  );
  expect(errors).toEqual([]);
});

test("a variant removed from a moved screen opens with links to that screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${served.url}/view/billing/invoice/paid/`);
  await expect(page.locator(".mbk-previous")).toHaveText(
    "Showing previous version",
  );
  const crumb = page
    .getByLabel("Catalogue location")
    .getByRole("link", { name: "Invoice", exact: true });
  await expect(crumb).toHaveAttribute("href", `/view/${INVOICE}/`);
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  const parent = page
    .locator(".mbk-meta-row", { hasText: "Variant of" })
    .getByRole("link", { name: "Invoice" });
  await expect(parent).toHaveAttribute("href", `/view/${INVOICE}/`);
});
