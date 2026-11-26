import { type Page, expect, test } from "@playwright/test";

import { DOCS_OVERVIEW, neighbours } from "../../src/docs/pages.js";

const PAGE = "/docs/cli/serve/";

/** The width from which the Layers panel shows beside the page frame. */
const LAYERS_PANEL = 1024;

/** The width from which the Inspect panel shows beside the page frame. */
const INSPECT_PANEL = 1280;

/** The page's width, which decides the composition. */
function width(page: Page): number {
  return page.viewportSize()?.width ?? 0;
}

/**
 * The section tree: the Layers panel, or below 1024px the tree sheet, which
 * the sub-bar's Layers control opens. The control is named by the section
 * and the page.
 */
async function tree(page: Page) {
  if (width(page) < LAYERS_PANEL) {
    await page.getByRole("button", { name: "CLI reference serve" }).click();
    await expect(page.getByRole("dialog", { name: "Layers" })).toBeVisible();
  }
  return page.getByRole("navigation", { name: "Documentation" });
}

test("the section tree links open another docs page", async ({ page }) => {
  await page.goto(PAGE);
  const sidebar = await tree(page);
  await sidebar.getByRole("link", { name: "Install", exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/start\/install\/$/);
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toHaveText("Install");
});

test(
  "the selected tree row keeps its position across docs pages",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto("/docs/start/install/");
    const scroll = page.locator(".site-docs-side .site-doc-tree-scroll");
    const link = scroll.locator('a[href="/docs/cli/check/"]');
    await scroll.evaluate((element) => {
      const row = element.querySelector('a[href="/docs/cli/check/"]');
      if (!row) throw new Error("check is missing from the docs tree");
      element.scrollTop +=
        row.getBoundingClientRect().top -
        element.getBoundingClientRect().top -
        element.clientHeight / 2;
    });
    const before = await scroll.evaluate((element) => {
      const row = element.querySelector('a[href="/docs/cli/check/"]');
      if (!row) throw new Error("check is missing from the docs tree");
      return {
        rowTop:
          row.getBoundingClientRect().top - element.getBoundingClientRect().top,
        scrollTop: element.scrollTop,
      };
    });
    expect(before.scrollTop).toBeGreaterThan(100);

    await link.click();
    await expect(page).toHaveURL(/\/docs\/cli\/check\/$/);
    const after = await scroll.evaluate((element) => {
      const row = element.querySelector('a[href="/docs/cli/check/"]');
      if (!row) throw new Error("check is missing from the docs tree");
      return {
        rowTop:
          row.getBoundingClientRect().top - element.getBoundingClientRect().top,
        scrollTop: element.scrollTop,
      };
    });
    expect(Math.abs(after.scrollTop - before.scrollTop)).toBeLessThan(2);
    expect(Math.abs(after.rowTop - before.rowTop)).toBeLessThan(2);
    await expect(scroll.locator('[aria-current="page"]')).toHaveAttribute(
      "href",
      "/docs/cli/check/",
    );
  },
);

test("on this page reaches the heading it names", async ({ page }) => {
  await page.goto(PAGE);
  // Below 1280px On this page sits in a disclosure, closed as the page opens.
  if (width(page) < INSPECT_PANEL) {
    await page.locator("summary", { hasText: "On this page" }).click();
  }
  const list = page.getByRole("navigation", { name: "On this page" });
  await expect(list).toBeVisible();
  const link = list.getByRole("link", { name: "The port" });
  await link.click();
  await expect(page).toHaveURL(/#the-port$/);
  await expect(page.locator("#the-port")).toBeInViewport();
});

test(
  "the serve pager opens the next page",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto(PAGE);
    const { next } = neighbours(PAGE);
    const pager = page.locator("nav[aria-label='Pagination']");
    await pager.getByRole("link", { name: /Next/ }).click();
    await expect(page).toHaveURL(new RegExp(`${next?.route ?? ""}$`));
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 }),
    ).toHaveText(next?.title ?? "");
  },
);

test(
  "the overview pager opens the first page",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto(DOCS_OVERVIEW.route);
    const pager = page.locator("nav[aria-label='Pagination']");
    await pager.getByRole("link", { name: /Next/ }).click();
    await expect(page).toHaveURL(/\/docs\/start\/install\/$/);
  },
);

test(
  "a code block copies its own text to the clipboard",
  { tag: "@desktop" },
  async ({ context, page }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/docs/start/install/");
    const panel = page.locator(".site-code").first();
    const copy = panel.locator("button.site-code-copy");
    await expect(copy).toHaveText("Copy");
    await copy.click();
    await expect(copy).toHaveText("Copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "npm install --save-dev @mokly/mokly",
    );
    await expect(copy).toHaveText("Copy", { timeout: 5000 });
  },
);
