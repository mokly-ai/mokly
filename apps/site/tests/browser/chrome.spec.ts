import { type Locator, type Page, expect, test } from "@playwright/test";

import {
  EXTERNAL_LINKS,
  GET_STARTED_PATH,
  SITE_PATHS,
} from "../../src/navigation.js";

import { headerDestinations, narrow, openMenu } from "./menu.js";
import { HEADINGS } from "./routes.js";

const HEADER_LINKS = [
  SITE_PATHS.home,
  SITE_PATHS.docs,
  SITE_PATHS.changelog,
  EXTERNAL_LINKS.github,
  GET_STARTED_PATH,
];

/** What the header row lists above the breakpoint and the menu below it. */
const DESTINATIONS = ["Docs", "Changelog", "GitHub", "Get started"];

const FOOTER_LINKS = [
  SITE_PATHS.home,
  SITE_PATHS.home,
  SITE_PATHS.docs,
  SITE_PATHS.changelog,
  SITE_PATHS.terms,
  SITE_PATHS.privacy,
  SITE_PATHS.complaints,
  SITE_PATHS.security,
];

/** The href of every anchor matched, including ones the viewport hides. */
async function hrefs(anchors: Locator): Promise<string[]> {
  return anchors.evaluateAll((nodes) =>
    nodes.map((anchor) => anchor.getAttribute("href") ?? ""),
  );
}

/**
 * A region's anchors. The banner's are the header row's, the brand and its
 * navigation; the menu's own links are checked with the menu.
 */
function anchors(page: Page, region: "banner" | "contentinfo"): Locator {
  return region === "banner"
    ? page.getByRole("banner").locator(".site-brand, .site-nav a")
    : page.getByRole("contentinfo").locator("a");
}

/** Follow a site route and assert the heading it publishes. */
async function walk(page: Page, href: string): Promise<void> {
  const heading = HEADINGS.get(href);
  expect(heading, `no published heading for ${href}`).toBeDefined();
  const response = await page.goto(href);
  expect(response?.status(), href).toBe(200);
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toHaveText(heading ?? "");
}

for (const region of ["banner", "contentinfo"] as const) {
  const expected = region === "banner" ? HEADER_LINKS : FOOTER_LINKS;
  test(`the ${region} links match the inventory and site routes resolve`, async ({
    page,
  }) => {
    await page.goto(SITE_PATHS.home);
    const found = await hrefs(anchors(page, region));
    expect(found).toEqual(expected);
    for (const href of new Set(found)) {
      if (href === EXTERNAL_LINKS.github || href === GET_STARTED_PATH) continue;
      await walk(page, href);
    }
  });
}

test("Get started opens the first Getting started guide", async ({ page }) => {
  await page.goto(SITE_PATHS.home);
  const header = await headerDestinations(page);
  await header.getByRole("link", { name: "Get started" }).click();
  await expect(page).toHaveURL(new RegExp(`${GET_STARTED_PATH}$`));
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toHaveText("Install");
});

test("the header composition follows the viewport", async ({ page }) => {
  const wide = !narrow(page);
  await page.goto(SITE_PATHS.home);
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Mokly home" })).toBeVisible();
  const control = header.getByRole("button", {
    exact: true,
    includeHidden: true,
    name: "Menu",
  });
  await expect(control).toHaveCount(1);
  await expect(control).toBeVisible({ visible: !wide });
  // The row keeps every destination; only the viewport decides whether it
  // is drawn. Its text includes the decorative arrow after Get started.
  const row = header.locator(".site-nav");
  await expect(row.locator("a")).toHaveText(
    DESTINATIONS.map((name) => new RegExp(`^${name}`)),
  );
  await expect(row).toBeVisible({ visible: wide });
  const visible = wide ? row : await openMenu(page);
  for (const name of DESTINATIONS) {
    await expect(
      visible.getByRole("link", { exact: true, name }),
    ).toBeVisible();
  }
});

test("the search control appears on documentation routes only", async ({
  page,
}) => {
  const search = page
    .getByRole("banner")
    .getByRole("button", { name: "Search docs" });
  await page.goto(SITE_PATHS.docs);
  await expect(search).toBeVisible();
  // Below the breakpoint the search takes the row beneath the brand.
  const brand = await page
    .getByRole("banner")
    .getByRole("link", { name: "Mokly home" })
    .boundingBox();
  const field = await search.boundingBox();
  expect((field?.y ?? 0) >= (brand?.y ?? 0) + (brand?.height ?? 0)).toBe(
    narrow(page),
  );
  for (const route of [SITE_PATHS.home, SITE_PATHS.changelog]) {
    await page.goto(route);
    await expect(search).toHaveCount(0);
  }
});

test("the current route is marked in the header and footer", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.docs);
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Docs" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("contentinfo").getByRole("link", {
      exact: true,
      name: "Home",
    }),
  ).not.toHaveAttribute("aria-current", "page");
  await expect(
    (await headerDestinations(page)).getByRole("link", { name: "Docs" }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto(SITE_PATHS.privacy);
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto(SITE_PATHS.changelog);
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Changelog" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    (await headerDestinations(page)).getByRole("link", { name: "Changelog" }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto(SITE_PATHS.security);
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Security" }),
  ).toHaveAttribute("aria-current", "page");
});

/** Every link and button in a region is at least 44px tall. */
async function assertTargets(region: Locator): Promise<void> {
  for (const role of ["link", "button"] as const) {
    for (const control of await region.getByRole(role).all()) {
      const box = await control.boundingBox();
      expect(
        box?.height ?? 0,
        (await control.getAttribute("aria-label")) ??
          (await control.innerText()),
      ).toBeGreaterThanOrEqual(44);
    }
  }
}

test("every header and footer target is at least 44px tall", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.docs);
  await assertTargets(page.getByRole("banner"));
  await assertTargets(page.getByRole("contentinfo"));
  if (narrow(page)) await assertTargets(await openMenu(page));
});
