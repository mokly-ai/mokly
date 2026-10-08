import { expect, test } from "@playwright/test";

import {
  detailsRow,
  hasMarker,
  markPage,
  openScreensGroup,
  tourRow,
  welcomeRow,
  workspaceRoute,
} from "./browse_assertions.js";
import { passRenderingUpdates } from "./comparison_regions_helpers.js";
import { settlement } from "./removed_preview_assertions.js";

test("durable links load complete server-rendered views", async ({ page }) => {
  await page.goto("/view/example/screens/welcome/");
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

test("catalogue separates specs and components into collapsible sections", async ({
  page,
}) => {
  await page.goto("/");
  const specs = page.locator('[data-nav-section="specs"]');
  const components = page.locator('[data-nav-section="components"]');
  await expect(specs.locator(":scope > summary")).toHaveText("Specs");
  await expect(components.locator(":scope > summary")).toHaveText("Components");
  await expect(specs).toHaveAttribute("open", "");
  await expect(components).toHaveAttribute("open", "");
  await expect(specs.locator('[data-entry-kind="component"]')).toHaveCount(0);
  await expect(
    components.locator(':not([data-entry-kind="component"])[data-nav-row]'),
  ).toHaveCount(0);
  expect(await specs.locator("[data-nav-row]").count()).toBeGreaterThan(0);
  expect(await components.locator("[data-nav-row]").count()).toBeGreaterThan(0);

  await components.locator(":scope > summary").click();
  await expect(components).not.toHaveAttribute("open", "");
  await page.reload();
  await expect(specs).toHaveAttribute("open", "");
  await expect(components).not.toHaveAttribute("open", "");

  await page.getByRole("button", { name: "Collapse all" }).click();
  await expect(specs).not.toHaveAttribute("open", "");
  await expect(components).not.toHaveAttribute("open", "");
});

test("progressive navigation swaps the main view without reloads", async ({
  page,
}) => {
  await page.goto("/");
  await markPage(page);
  await openScreensGroup(page);
  await page.click(welcomeRow);
  await expect(page).toHaveURL(/\/view\/example\/screens\/welcome\/$/);
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
  await expect(page).toHaveURL(/details\/$/);
  await page.goBack();
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await page.goForward();
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  expect(await hasMarker(page)).toBe(true);
});

test("breadcrumbs track hierarchy through progressive history", async ({
  page,
}) => {
  await page.goto("/view/example/screens/welcome/");
  const crumbs = page.getByLabel("Catalogue location");
  await expect(crumbs).toHaveText("Example›Screens");
  await expect(crumbs.locator("a")).toHaveAttribute("href", "/view/example/");

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
  await page.goto("/view/example/screens/welcome/");
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

test("overlapping navigations are latest-wins", async ({ page }) => {
  await page.goto("/");
  await markPage(page);
  await openScreensGroup(page);
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/view/example/screens/welcome/", async (route) => {
    if (route.request().resourceType() !== "fetch") return route.continue();
    await released;
    return route.continue();
  });
  const settled = settlement(page, "/view/example/screens/welcome/");
  try {
    const held = page.waitForRequest(
      (request) =>
        request.resourceType() === "fetch" &&
        request.url().endsWith("/view/example/screens/welcome/"),
    );
    await page.click(welcomeRow);
    await held;
    await page.click(detailsRow);
    await expect(page.locator("#mb-main h2")).toHaveText("Details");
    await expect(page).toHaveURL(/details\/$/);
  } finally {
    release();
  }
  await expect.poll(settled).toBe(true);
  await passRenderingUpdates(page);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  expect(await hasMarker(page)).toBe(true);
});

test("failed route evidence keeps public navigation and rejects the previous owner", async ({
  page,
}) => {
  await page.goto("/view/example/screens/details/");
  await markPage(page);
  await expect.poll(() => workspaceRoute(page)).toBe("example/screens/details");
  let fetches = 0;
  await page.route("**/view/example/screens/welcome/", (route) =>
    route.request().resourceType() === "fetch"
      ? ((fetches += 1), route.abort())
      : route.continue(),
  );
  await page.click(welcomeRow);
  await expect(page).toHaveURL(/welcome\/$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await expect.poll(() => fetches).toBe(1);
  await expect.poll(() => workspaceRoute(page)).toBe("example/screens/welcome");
  expect(await hasMarker(page)).toBe(true);
});
