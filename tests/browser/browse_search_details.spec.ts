import { expect } from "@playwright/test";

import {
  accentFill,
  computedStyle,
  detailsRow,
  formsChip,
  hasMarker,
  markPage,
  tourRow,
  welcomeRow,
} from "./browse_assertions.js";
import { test } from "./browser_test.js";

test("search matches authored entry paths", async ({ page }) => {
  await page.goto("/");
  await page.fill("[data-mokly-search]", "example/screens/details");

  await expect(page.locator(detailsRow)).toBeVisible();
  await expect(page.locator(welcomeRow)).toBeHidden();
  await expect(page.locator(tourRow)).toBeHidden();
});

test("searching opens groups and clearing restores their disclosure", async ({
  page,
}) => {
  await page.goto("/");
  const screensGroup = 'details[data-nav-folder="folder:example/screens"]';
  await expect(page.locator(screensGroup)).toBeAttached();
  await page.evaluate((selector) => {
    document.querySelector<HTMLDetailsElement>(selector)!.open = false;
  }, screensGroup);
  await page.fill("[data-mokly-search]", "welcome");
  await expect(page.locator(welcomeRow)).toBeVisible();
  expect(
    await page.evaluate(
      (selector) => document.querySelector<HTMLDetailsElement>(selector)!.open,
      screensGroup,
    ),
  ).toBe(true);
  await page.fill("[data-mokly-search]", "");
  await expect
    .poll(() =>
      page.evaluate(
        (selector) =>
          document.querySelector<HTMLDetailsElement>(selector)!.open,
        screensGroup,
      ),
    )
    .toBe(false);
});

test("the tag chips of Inspect's Details rows enter, keep, and clear their term", async ({
  page,
}) => {
  await page.goto("/view/example/screens/welcome/");
  await expect(page.locator(tourRow)).toBeVisible();
  await markPage(page);

  // Inspect's head shows the Details rows, the tags among them.
  await page.click(formsChip);
  await expect(page.locator("[data-mokly-search]")).toHaveValue("tag:forms");
  await expect(page.locator(formsChip)).toHaveClass(/active/);
  expect(await computedStyle(page, formsChip, "backgroundColor")).toBe(
    accentFill,
  );
  await expect(page.locator(welcomeRow)).toBeVisible();
  await expect(page.locator(detailsRow)).toBeVisible();
  await expect(page.locator(tourRow)).toBeHidden();

  await page.click(detailsRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expect(page.locator("[data-mokly-search]")).toHaveValue("tag:forms");
  await expect(page.locator(formsChip)).toHaveClass(/active/);

  await page.click(formsChip);
  await expect(page.locator("[data-mokly-search]")).toHaveValue("");
  await expect(page.locator(formsChip)).not.toHaveClass(/active/);
  await expect(page.locator(tourRow)).toBeVisible();
  expect(await hasMarker(page)).toBe(true);
});

test("direct entry loads disclose saved-closed active ancestry", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "mokly:nav-disclosure:v4",
      JSON.stringify({
        "section:specs": false,
        "folder:specs:example": false,
        "folder:specs:example/screens": false,
      }),
    ),
  );
  await page.goto("/view/example/screens/welcome/");
  await expect(
    page.locator(
      '[data-nav-section="specs"] details[data-nav-folder="folder:example"]',
    ),
  ).toHaveAttribute("open", "");
  await expect(
    page.locator('details[data-nav-folder="folder:example/screens"]'),
  ).toHaveAttribute("open", "");
  await expect(
    page.locator('a[data-nav-row][data-entry-id="example/screens/welcome"]'),
  ).toBeVisible();
});
