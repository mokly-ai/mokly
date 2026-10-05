import { expect, test, type Page } from "@playwright/test";

import { scaledTimeLimit } from "../helpers/time_limits.js";

import {
  startDocumentChangesFixture,
  type DocumentChangesFixture,
} from "./document_changes_fixture.js";

let served: DocumentChangesFixture;

test.beforeAll(async () => {
  test.setTimeout(scaledTimeLimit(120_000));
  served = await startDocumentChangesFixture();
});

test.afterAll(async () => {
  if (served) await served.close();
});

const DOCUMENT_ICON = '.mbk-nav-ico path[d="M9 13h6M9 17h4"]';

function row(page: Page, entry: string) {
  return page.locator(`nav.mbk-nav a[data-nav-row][data-entry-id="${entry}"]`);
}

/** The trailing changed dot the stylesheet draws, or `none` when unmarked. */
function dot(page: Page, entry: string) {
  return row(page, entry).evaluate(
    (element) => getComputedStyle(element, "::after").content,
  );
}

test("an unmodified index row stays an undotted container and opens its first changed member", async ({
  page,
}) => {
  await page.goto(`${served.url}/view/account/profile/notifications/`);
  await page.click('[data-filter="changed"]');
  const profile = row(page, "account/profile");
  await expect(profile).toBeVisible();
  await expect(profile).not.toHaveAttribute("data-changed", "true");
  await expect(profile).not.toHaveAttribute("data-changed-variants", "true");
  expect(await dot(page, "account/profile")).toBe("none");
  await expect(row(page, "account/profile/security")).toBeVisible();
  expect(await dot(page, "account/profile/security")).not.toBe("none");
  await expect(row(page, "account/profile/notifications")).toBeHidden();

  await profile.click();
  await expect(page).toHaveURL(/\/view\/account\/profile\/security\/$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Security");
  await expect(row(page, "account/profile/security")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator('[data-filter="changed"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("a removed document is a Changes-only row with the document icon", async ({
  page,
}) => {
  await page.goto(`${served.url}/view/guide/`);
  const removed = row(page, "guide/old-terms");
  await expect(removed).toBeHidden();
  await page.fill("[data-mokly-search]", "old");
  await expect(removed).toBeHidden();
  await page.fill("[data-mokly-search]", "");
  await page.click('[data-filter="changed"]');
  await expect(removed).toBeVisible();
  await expect(removed).toHaveAttribute("data-entry-kind", "document");
  await expect(removed).toHaveAccessibleName(/^Old terms · Removed/u);
  await expect(removed.locator(DOCUMENT_ICON)).toHaveCount(1);
  await page.fill("[data-mokly-search]", "old");
  await expect(removed).toBeVisible();
});

test("a related document opens its entry, labelled with its title", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${served.url}/view/account/profile/`);
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  const related = page
    .locator(".mbk-meta-row", { hasText: "Related docs" })
    .getByRole("link", { name: "Payment terms" });
  await expect(related).toHaveAttribute("href", "/view/guide/terms/");
  await related.click();
  await expect(page).toHaveURL(/\/view\/guide\/terms\/$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Payment terms");
  await expect(row(page, "guide/terms")).toHaveAttribute(
    "aria-current",
    "page",
  );
});
