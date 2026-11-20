import { type Page, expect, test } from "@playwright/test";

import { openSearch } from "./search.js";

const TREE = ".site-docs-side .site-doc-tree-scroll";

async function treeState(page: Page) {
  return page.locator(TREE).evaluate((element) => {
    const current = element.querySelector<HTMLElement>('[aria-current="page"]');
    if (!current) throw new Error("current page is missing from the docs tree");
    const viewport = element.getBoundingClientRect();
    const row = current.getBoundingClientRect();
    return {
      currentHref: current.getAttribute("href"),
      rowVisible:
        row.top >= viewport.top - 1 && row.bottom <= viewport.bottom + 1,
      scrollTop: element.scrollTop,
      windowScrollY: window.scrollY,
    };
  });
}

test(
  "a direct lower-tree URL reveals the current page without moving the article",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto("/docs/review/agent-sessions/");
    const state = await treeState(page);
    expect(state.currentHref).toBe("/docs/review/agent-sessions/");
    expect(state.scrollTop).toBeGreaterThan(0);
    expect(state.rowVisible).toBe(true);
    expect(state.windowScrollY).toBe(0);
  },
);

test(
  "search and pagination reveal the current row",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto("/docs/start/install/");
    const dialog = await openSearch(page);
    await dialog.getByRole("searchbox").fill("publish");
    await dialog.getByRole("link", { name: "publish", exact: true }).click();
    await expect(page).toHaveURL(/\/docs\/cli\/publish\/$/);
    const searched = await treeState(page);
    expect(searched.currentHref).toBe("/docs/cli/publish/");
    expect(searched.rowVisible).toBe(true);
    expect(searched.windowScrollY).toBe(0);

    await page.locator(TREE).evaluate(async (element) => {
      element.scrollTop = 0;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    });
    await page
      .getByRole("navigation", { name: "Pagination" })
      .getByRole("link", { name: /Next/ })
      .click();
    await expect(page).toHaveURL(/\/docs\/cli\/options-and-exit-status\/$/);
    const paged = await treeState(page);
    expect(paged.currentHref).toBe("/docs/cli/options-and-exit-status/");
    expect(paged.rowVisible).toBe(true);
    expect(paged.windowScrollY).toBe(0);
  },
);

test(
  "refresh and browser history preserve the desktop tree and article",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto("/docs/cli/check/");
    const before = await treeState(page);
    expect(before.rowVisible).toBe(true);
    expect(before.scrollTop).toBeGreaterThan(0);

    await page.reload();
    const refreshed = await treeState(page);
    expect(refreshed.rowVisible).toBe(true);
    expect(Math.abs(refreshed.scrollTop - before.scrollTop)).toBeLessThan(2);

    await page.evaluate(() => window.scrollTo(0, 400));
    const articleBefore = await page.evaluate(() => window.scrollY);
    expect(articleBefore).toBeGreaterThan(300);
    await page.locator(TREE).locator('a[href="/docs/cli/export/"]').click();
    await expect(page).toHaveURL(/\/docs\/cli\/export\/$/);
    expect((await treeState(page)).rowVisible).toBe(true);

    await page.goBack();
    await expect(page).toHaveURL(/\/docs\/cli\/check\/$/);
    const back = await treeState(page);
    expect(back.rowVisible).toBe(true);
    expect(back.scrollTop).toBeGreaterThan(0);
    expect(Math.abs(back.windowScrollY - articleBefore)).toBeLessThan(2);

    await page.goForward();
    await expect(page).toHaveURL(/\/docs\/cli\/export\/$/);
    const forward = await treeState(page);
    expect(forward.rowVisible).toBe(true);
    expect(forward.scrollTop).toBeGreaterThan(0);
  },
);

test(
  "mobile docs navigation opens a fresh closed disclosure",
  { tag: "@mobile" },
  async ({ page }) => {
    await page.goto("/docs/start/install/");
    const disclosure = page.locator("details.site-doc-disclosure");
    await expect(disclosure).toHaveJSProperty("open", false);
    await disclosure.locator("summary").click();
    await expect(disclosure).toHaveJSProperty("open", true);
    await disclosure.locator('a[href="/docs/cli/check/"]').click();
    await expect(page).toHaveURL(/\/docs\/cli\/check\/$/);
    await expect(disclosure).toHaveJSProperty("open", false);
  },
);

test(
  "the docs tree works when tab storage is unavailable",
  { tag: "@desktop" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new DOMException("storage disabled", "SecurityError");
      };
      Storage.prototype.setItem = () => {
        throw new DOMException("storage disabled", "SecurityError");
      };
    });
    await page.goto("/docs/review/agent-sessions/");
    expect((await treeState(page)).rowVisible).toBe(true);
    await page
      .locator(TREE)
      .locator('a[href="/docs/review/pull-request-sync/"]')
      .click();
    await expect(page).toHaveURL(/\/docs\/review\/pull-request-sync\/$/);
    expect((await treeState(page)).rowVisible).toBe(true);
    expect(errors).toEqual([]);
  },
);

test(
  "keyboard navigation keeps a lower tree row visible",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto("/docs/start/install/");
    const link = page.locator(TREE).locator('a[href="/docs/cli/check/"]');
    await link.focus();
    await expect(link).toBeFocused();
    expect(
      await page.locator(TREE).evaluate((element) => element.scrollTop),
    ).toBeGreaterThan(0);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/docs\/cli\/check\/$/);
    const destination = await treeState(page);
    expect(destination.currentHref).toBe("/docs/cli/check/");
    expect(destination.rowVisible).toBe(true);
    expect(destination.scrollTop).toBeGreaterThan(0);
  },
);
