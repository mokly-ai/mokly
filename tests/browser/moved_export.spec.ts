import { expect, test } from "@playwright/test";

import {
  exportMovedChanges,
  type MovedChangesHost,
} from "./moved_changes_fixture.js";

let site: MovedChangesHost;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  site = await exportMovedChanges();
});

test.afterAll(async () => {
  if (site) await site.close();
});

test("an exported catalogue keeps Moved rows, the previous path, and its earlier side", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !/sandboxed/u.test(message.text()))
      errors.push(message.text());
  });
  await page.goto(`${site.url}/view/account/billing/invoice/`);
  await page.click('[data-filter="changed"]');
  const invoice = page.locator(
    'nav.mbk-nav a[data-nav-row][data-entry-id="account/billing/invoice"]',
  );
  await expect(invoice).toHaveAccessibleName("Invoice · Moved");
  await expect(
    page.locator(
      'nav.mbk-nav a[data-nav-row][data-entry-id="account/billing/payment-terms"]',
    ),
  ).toHaveAccessibleName("Payment terms · Moved");
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(
    page.locator(".mbk-meta-row", { hasText: "Moved from" }),
  ).toHaveText("Moved frombilling/invoice");
  await page
    .getByRole("group", { name: "Comparison mode" })
    .getByRole("button", { name: "Side by side", exact: true })
    .click();
  const before = page.locator(
    'iframe[data-mokly-comparison-frame][data-mokly-preview-source*="/snapshots/before/billing/invoice/"]',
  );
  await expect(before.first()).toHaveAttribute("srcdoc", /Due in 14 days/u);
  expect(errors).toEqual([]);
});
