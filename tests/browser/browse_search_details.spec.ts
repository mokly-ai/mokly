import { expect, test } from "@playwright/test";

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

test("search matches authored entry paths", async ({ page }) => {
  await page.goto("/");
  await page.fill("[data-mokly-search]", "example/screens/details");

  await expect(page.locator(detailsRow)).toBeVisible();
  await expect(page.locator(welcomeRow)).toBeHidden();
  await expect(page.locator(tourRow)).toBeHidden();
});

test("details starts collapsed and remembers disclosure", async ({ page }) => {
  const details = page.locator("[data-workspace-inspector]");
  await page.goto("/view/example/screens/welcome/");
  await expect(details).not.toHaveAttribute("data-open", "true");
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(details).toHaveAttribute("data-open", "true");

  await page.click(detailsRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expect(details).toHaveAttribute("data-open", "true");

  await page.reload();
  await expect(details).toHaveAttribute("data-open", "true");
  await page.evaluate(() => {
    document
      .querySelector<HTMLElement>('[data-inspector-tab="details"]')
      ?.click();
    window.location.assign("/view/example/screens/welcome/");
  });
  await page.waitForURL(/\/view\/example\/screens\/welcome\/$/);
  await expect(details).not.toHaveAttribute("data-open", "true");
});

test("searching opens groups and clearing restores their disclosure", async ({
  page,
}) => {
  await page.goto("/");
  const screensGroup = 'details[data-nav-folder="folder:example/screens"]';
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

test("details tag chips enter, keep, and clear their term", async ({
  page,
}) => {
  await page.goto("/view/example/screens/welcome/");
  await expect(page.locator(tourRow)).toBeVisible();
  await markPage(page);

  await page.locator('[data-inspector-tab="details"]').click();
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
