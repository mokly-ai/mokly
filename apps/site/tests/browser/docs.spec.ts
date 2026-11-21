import { type Page, expect, test } from "@playwright/test";

import { DOCS_OVERVIEW, neighbours } from "../../src/docs/pages.js";

import { openSearch } from "./search.js";

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

test("the documentation page renders the tree, the lead and the pager", async ({
  page,
}) => {
  const response = await page.goto(PAGE);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("serve · Mokly");
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toHaveText("serve");
  await expect(page.locator(".site-pullquote")).toHaveText(
    "Build and serve the catalogue with on-demand previews and comparisons.",
  );
  await expect(page.locator("nav[aria-label='Location']")).toContainText(
    "CLI reference",
  );
});

test("the section tree marks the page and opens another one", async ({
  page,
}) => {
  await page.goto(PAGE);
  const sidebar = await tree(page);
  await expect(sidebar.locator('[aria-current="page"]')).toHaveText("serve");
  await expect(sidebar.getByRole("link", { name: "Changelog" })).toHaveCount(1);
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

test("the tree carries the published version and links the changelog", async ({
  page,
}) => {
  await page.goto(PAGE);
  const sidebar = await tree(page);
  const version = sidebar.locator(".site-version");
  await expect(version).toContainText("Mokly CLI");
  await expect(version).toHaveText(/\d+\.\d+\.\d+/);
});

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

test("previous and next follow the order of the tree", async ({ page }) => {
  await page.goto(PAGE);
  const { next, previous } = neighbours(PAGE);
  const pager = page.locator("nav[aria-label='Pagination']");
  await expect(pager.getByRole("link", { name: /Previous/ })).toHaveAttribute(
    "href",
    previous?.route ?? "",
  );
  await pager.getByRole("link", { name: /Next/ }).click();
  await expect(page).toHaveURL(new RegExp(`${next?.route ?? ""}$`));
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toHaveText(next?.title ?? "");
});

test("the overview has no previous link and opens the first page", async ({
  page,
}) => {
  await page.goto(DOCS_OVERVIEW.route);
  const pager = page.locator("nav[aria-label='Pagination']");
  await expect(pager.getByRole("link", { name: /Previous/ })).toHaveCount(0);
  await pager.getByRole("link", { name: /Next/ }).click();
  await expect(page).toHaveURL(/\/docs\/start\/install\/$/);
});

test("a code block copies its own text to the clipboard", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/docs/start/install/");
  const panel = page.locator(".site-code").first();
  await expect(panel.locator(".site-code-language")).toHaveText("shell");
  const copy = panel.locator("button.site-code-copy");
  await expect(copy).toHaveText("Copy");
  await copy.click();
  await expect(copy).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "npm install --save-dev @mokly/mokly",
  );
  await expect(copy).toHaveText("Copy", { timeout: 5000 });
});

test("search finds the page that answers the query", async ({ page }) => {
  await page.goto(PAGE);
  const dialog = await openSearch(page);
  await dialog.getByRole("searchbox").fill("publish");
  const result = dialog.getByRole("link", { name: "publish", exact: true });
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("href", "/docs/cli/publish/");
  await result.click();
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toHaveText("publish");
});

test("a published protocol document reads as a documentation page", async ({
  page,
}) => {
  await page.goto("/docs/reference/upload/");
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toHaveText("Catalogue upload");
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: "exchange contract", exact: true })
      .first(),
  ).toHaveAttribute("href", "/docs/reference/upload-exchange/#upload-exchange");
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: "ownership marker", exact: true })
      .first(),
  ).toBeVisible();
});

test("a repository-owned guide renders its Markdown body", async ({ page }) => {
  await page.goto("/docs/cloud/overview/");
  await expect(
    page.getByRole("main").getByRole("heading", {
      level: 2,
      name: "A catalogue for every branch",
    }),
  ).toBeVisible();
});
