import { type Locator, type Page, expect, test } from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";

import { BREAKPOINT, HEADINGS, SIGN_IN, SIGN_UP } from "./routes.js";

const HEADER_LINKS = [
  SITE_PATHS.home,
  SITE_PATHS.docs,
  SITE_PATHS.changelog,
  SIGN_IN,
  SIGN_UP,
];

const FOOTER_LINKS = [
  SITE_PATHS.home,
  SITE_PATHS.home,
  SITE_PATHS.docs,
  SITE_PATHS.changelog,
  SIGN_IN,
  SIGN_UP,
  SITE_PATHS.terms,
  SITE_PATHS.privacy,
];

/** The href of every anchor in a region, including ones the viewport hides. */
async function hrefs(region: Locator): Promise<string[]> {
  return region
    .locator("a")
    .evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href") ?? ""),
    );
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
  test(`the ${region} links reach every destination`, async ({ page }) => {
    await page.goto(SITE_PATHS.home);
    const found = await hrefs(page.getByRole(region));
    expect(found).toEqual(expected);
    for (const href of new Set(found)) {
      if (href.startsWith("/")) await walk(page, href);
      else expect([SIGN_IN, SIGN_UP]).toContain(href);
    }
  });
}

test("the application links resolve against the application origin", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.home);
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Sign in" }),
  ).toHaveAttribute("href", SIGN_IN);
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Get started" }),
  ).toHaveAttribute("href", SIGN_UP);
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Sign in" }),
  ).toHaveAttribute("href", SIGN_IN);
});

test("the header composition follows the viewport", async ({ page }, info) => {
  const desktop = (info.project.use.viewport?.width ?? 0) >= BREAKPOINT;
  await page.goto(SITE_PATHS.home);
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Mokly home" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Docs" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Sign in" })).toBeVisible();
  for (const name of ["Changelog", "Get started"]) {
    await expect(header.getByRole("link", { exact: true, name })).toBeVisible({
      visible: desktop,
    });
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
    page.getByRole("banner").getByRole("link", { name: "Docs" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Docs" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("contentinfo").getByRole("link", {
      exact: true,
      name: "Home",
    }),
  ).not.toHaveAttribute("aria-current", "page");
  await page.goto(SITE_PATHS.privacy);
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }),
  ).toHaveAttribute("aria-current", "page");
});

test("every header and footer target is at least 44px tall", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.docs);
  for (const region of ["banner", "contentinfo"] as const) {
    for (const role of ["link", "button"] as const) {
      for (const control of await page
        .getByRole(region)
        .getByRole(role)
        .all()) {
        const box = await control.boundingBox();
        expect(
          box?.height ?? 0,
          await control.innerText(),
        ).toBeGreaterThanOrEqual(44);
      }
    }
  }
});
