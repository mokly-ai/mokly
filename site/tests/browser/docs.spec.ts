import { type Page, expect, test } from "@playwright/test";

import { DOCS_OVERVIEW, neighbours } from "../../src/docs/pages.js";

import { BREAKPOINT } from "./routes.js";

const PAGE = "/docs/cli/serve/";

/** The composition a viewport resolves: the tree is a disclosure below it. */
function narrow(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < BREAKPOINT;
}

/** The section tree, opening the disclosure first on a narrow viewport. */
async function tree(page: Page) {
  if (!narrow(page)) return page.locator(".site-docs-side .site-doc-tree");
  await page.locator("details.site-doc-disclosure > summary").click();
  return page.locator("details.site-doc-disclosure .site-doc-tree");
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
  const list = page.locator(".site-onpage:visible").first();
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
    "npm install --save-dev @mokly/mokly react react-dom",
  );
  await expect(copy).toHaveText("Copy", { timeout: 5000 });
});

test("search finds the page that answers the query", async ({ page }) => {
  await page.goto(PAGE);
  const dialog = page.locator("dialog.site-search-dialog");
  await expect(async () => {
    await page.getByRole("button", { name: "Search docs" }).click();
    await expect(dialog).toBeVisible();
  }).toPass();
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
    page.getByRole("main").getByRole("link", { name: "Publish Catalogue" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/mokly-ai/mokly/blob/main/plans/publish-catalogue.md",
  );
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: "export", exact: false })
      .first(),
  ).toBeVisible();
});
