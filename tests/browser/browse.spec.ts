import { expect, test } from "@playwright/test";

import {
  welcomeRow,
  detailsRow,
  tourRow,
  markPage,
  hasMarker,
  openScreensGroup,
} from "./browse_assertions.js";

test("durable links load complete server-rendered views", async ({ page }) => {
  await page.goto("/view/screens/example-welcome.html");
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await expect(page.locator(".mbk-frame-mobile iframe")).toHaveAttribute(
    "sandbox",
    "allow-same-origin",
  );
  await expect(page.locator(welcomeRow)).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("catalogue separates pages and components into collapsible sections", async ({
  page,
}) => {
  await page.goto("/");
  const pages = page.locator('[data-nav-section="pages"]');
  const components = page.locator('[data-nav-section="components"]');
  await expect(pages.locator(":scope > summary")).toHaveText("Pages");
  await expect(components.locator(":scope > summary")).toHaveText("Components");
  await expect(pages).toHaveAttribute("open", "");
  await expect(components).toHaveAttribute("open", "");
  await expect(pages.locator('[data-entry-kind="component"]')).toHaveCount(0);
  await expect(
    components.locator(':not([data-entry-kind="component"])[data-nav-row]'),
  ).toHaveCount(0);
  expect(await pages.locator("[data-nav-row]").count()).toBeGreaterThan(0);
  expect(await components.locator("[data-nav-row]").count()).toBeGreaterThan(0);

  await components.locator(":scope > summary").click();
  await expect(components).not.toHaveAttribute("open", "");
  await page.reload();
  await expect(pages).toHaveAttribute("open", "");
  await expect(components).not.toHaveAttribute("open", "");

  await page.getByRole("button", { name: "Collapse all" }).click();
  await expect(pages).not.toHaveAttribute("open", "");
  await expect(components).not.toHaveAttribute("open", "");
});

test("progressive navigation swaps the main view without reloads", async ({
  page,
}) => {
  await page.goto("/");
  await markPage(page);
  await openScreensGroup(page);
  await page.click(welcomeRow);
  await expect(page).toHaveURL(/\/view\/screens\/example-welcome\.html$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  expect(await hasMarker(page)).toBe(true);
  await expect(page.locator(welcomeRow)).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(await page.evaluate(() => document.activeElement?.id ?? "")).toBe(
    "mb-main",
  );
  await expect(page.locator("#mb-status")).toContainText("Welcome");

  await page.click(detailsRow);
  await expect(page).toHaveURL(/details\.html$/);
  await page.goBack();
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await page.goForward();
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  expect(await hasMarker(page)).toBe(true);
});

test("breadcrumbs track hierarchy through progressive history", async ({
  page,
}) => {
  await page.goto("/view/screens/example-welcome.html");
  const crumbs = page.getByLabel("Catalogue location");
  await expect(crumbs).toHaveText("Example›Screens");
  await expect(crumbs.locator("a")).toHaveCount(0);

  await page.click(tourRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Example tour");
  await expect(crumbs).toHaveText("Example");
  await page.goBack();
  await expect(crumbs).toHaveText("Example›Screens");
  await page.goForward();
  await expect(crumbs).toHaveText("Example");
});

test("Back and Forward restore each route's stage scroll", async ({ page }) => {
  await page.setViewportSize({ height: 500, width: 1_280 });
  await page.goto("/view/screens/example-welcome.html");
  await page.click(detailsRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  const destinationScroll = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(
      '[data-mokly-scroll="stage"]',
    );
    if (!stage) return -1;
    stage.scrollTop = 500;
    stage.dispatchEvent(new Event("scroll"));
    return stage.scrollTop;
  });
  expect(destinationScroll).toBeGreaterThan(100);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (history.state as { scrolls?: { stage?: number } } | null)?.scrolls
            ?.stage,
      ),
    )
    .toBe(destinationScroll);

  await page.goBack();
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await page.goForward();
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.querySelector<HTMLElement>('[data-mokly-scroll="stage"]')
            ?.scrollTop,
      ),
    )
    .toBe(destinationScroll);
});

test("search state is retained across in-shell navigation", async ({
  page,
}) => {
  await page.goto("/");
  await markPage(page);
  await page.fill("[data-mokly-search]", "welcome");
  await expect(page.locator(detailsRow)).toBeHidden();
  await page.click(welcomeRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await expect(page.locator("[data-mokly-search]")).toHaveValue("welcome");
  await expect(page.locator(detailsRow)).toBeHidden();
  expect(await hasMarker(page)).toBe(true);
});
