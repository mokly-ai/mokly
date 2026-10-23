import { expect, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import {
  startNavigationFixture,
  type NavigationFixture,
} from "./navigation_fixture.js";

let navigation: NavigationFixture;

const LIST = '[data-nav-disclosure="variants:fixture/nested/home"]';
const TOGGLE = "[data-nav-variants-toggle]";
const HOME_ROW = 'a[data-nav-row][data-route="fixture/nested/home/index.html"]';
const EMPTY_ROW =
  'a[data-nav-row][data-route="fixture/nested/home/empty/index.html"]';
const ERROR_ROW =
  'a[data-nav-row][data-route="fixture/nested/home/error/index.html"]';
test.beforeAll(async () => {
  navigation = await startNavigationFixture();
});

test.afterAll(async () => {
  await navigation?.close();
});

/** Open the catalogue at a route whose variant list starts closed. */
async function openDetails(page: Page): Promise<void> {
  await page.goto(`${navigation.url}/view/fixture/nested/details/`);
  await expect(page.locator(LIST)).toBeHidden();
  await expect(page.locator(TOGGLE)).toHaveAttribute("aria-expanded", "false");
}

test("the variant disclosure opens, navigates, and returns through history", async ({
  page,
}) => {
  await openDetails(page);

  await page.click(TOGGLE);
  await expect(page.locator(LIST)).toBeVisible();
  await expect(page.locator(TOGGLE)).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(TOGGLE)).toHaveAttribute(
    "aria-label",
    "Hide variants of Home",
  );
  await expect(page.locator(EMPTY_ROW)).toBeVisible();
  await expect(page.locator(ERROR_ROW)).toBeVisible();

  await page.click(EMPTY_ROW);
  await expect(page).toHaveURL(/\/view\/fixture\/nested\/home\/empty\/$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Empty workspace");
  await expect(page.locator(EMPTY_ROW)).toHaveAttribute("aria-current", "page");
  await expect(page.locator(HOME_ROW)).not.toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator(LIST)).toBeVisible();
  const crumbLink = page.getByLabel("Catalogue location").locator("a");
  await expect(crumbLink).toHaveText("Home");
  await expect(crumbLink).toHaveAttribute("href", "/view/fixture/nested/home/");

  await page.goBack();
  await expect(page).toHaveURL(/\/view\/fixture\/nested\/details\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/view\/fixture\/nested\/home\/empty\/$/);
  await expect(page.locator(EMPTY_ROW)).toHaveAttribute("aria-current", "page");

  await crumbLink.click();
  await expect(page).toHaveURL(/\/view\/fixture\/nested\/home\/$/);
  await expect(page.locator(HOME_ROW)).toHaveAttribute("aria-current", "page");
  await expect(page.locator(LIST)).toBeVisible();
});

test("Collapse all closes a variant list and reload restores the choice", async ({
  page,
}) => {
  await page.goto(`${navigation.url}/view/fixture/nested/home/empty/`);
  await expect(page.locator(LIST)).toBeVisible();

  await page.getByRole("button", { name: "Collapse all" }).click();
  await expect(page.locator(LIST)).toBeHidden();
  await expect(page.locator(TOGGLE)).toHaveAttribute("aria-expanded", "false");

  await page.goto(`${navigation.url}/view/fixture/nested/details/`);
  await expect(page.locator(LIST)).toBeHidden();

  await page.click(TOGGLE);
  await expect(page.locator(LIST)).toBeVisible();
  await page.reload();
  await expect(page.locator(LIST)).toBeVisible();
  await expect(page.locator(TOGGLE)).toHaveAttribute("aria-expanded", "true");
});

test("search through a variant title keeps its parent row visible", async ({
  page,
}) => {
  await openDetails(page);

  await page.fill("[data-mokly-search]", "Empty workspace");

  await expect(page.locator(EMPTY_ROW)).toBeVisible();
  await expect(page.locator(HOME_ROW)).toBeVisible();
  await expect(page.locator(LIST)).toBeVisible();
  await expect(
    page.locator('a[data-nav-row][data-route="other/extra/index.html"]'),
  ).toBeHidden();

  await page.fill("[data-mokly-search]", "extra");
  await expect(page.locator(HOME_ROW)).toBeHidden();
  await expect(page.locator(LIST)).toBeHidden();
  await expect(page.locator(TOGGLE)).toBeHidden();

  await page.fill("[data-mokly-search]", "");
  await expect(page.locator(HOME_ROW)).toBeVisible();
  await expect(page.locator(TOGGLE)).toBeVisible();
});
