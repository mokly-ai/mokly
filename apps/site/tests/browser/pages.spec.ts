import { type Page, expect, test } from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";
import { NOT_FOUND_PAGE, ROUTES } from "../helpers/published-routes.js";

import { assertFocusGlow } from "./accessibility.js";

const UNKNOWN_ROUTE = "/does-not-exist/";
const NOT_FOUND_FILE = `${NOT_FOUND_PAGE.route}.html`;
const SAMPLE_GUIDE = "/docs/start/your-first-screen/";

const TEMPLATES = [
  // pages/index.astro also represents the shared layouts/Site.astro chrome.
  SITE_PATHS.home,
  // pages/docs/index.astro also represents layouts/Docs.astro and its panels.
  SITE_PATHS.docs,
  // pages/changelog.astro and pages/pricing.astro.
  SITE_PATHS.changelog,
  SITE_PATHS.pricing,
  // pages/terms.astro, privacy.astro, complaints.astro and security.astro.
  SITE_PATHS.terms,
  SITE_PATHS.privacy,
  SITE_PATHS.complaints,
  SITE_PATHS.security,
  // pages/404.astro. Visit the file directly to watch for unexpected errors.
  NOT_FOUND_FILE,
];

async function visit(page: Page, pathname: string): Promise<void> {
  const expected =
    pathname === UNKNOWN_ROUTE || pathname === NOT_FOUND_FILE
      ? NOT_FOUND_PAGE
      : ROUTES.find(({ route }) => route === pathname);
  if (!expected) throw new Error(`No expected page for ${pathname}`);

  const response = await page.goto(pathname);
  expect(response?.status(), `${pathname} response status`).toBe(
    pathname === UNKNOWN_ROUTE ? 404 : 200,
  );
  expect(new URL(page.url()).pathname, `${pathname} final pathname`).toBe(
    pathname,
  );
  await expect(page, `${pathname} page title`).toHaveTitle(expected.title);
}

/** Collect the failures a page must not produce while it loads. */
function watch(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => errors.push(request.url()));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

/** A developer asks for the full-page captures; a CI run writes none. */
const capturesRequested = process.env["MKC_SITE_CAPTURES"] === "1";

async function checkFocus(page: Page): Promise<void> {
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await assertFocusGlow(page);
  await checkControlNames(page);
}

async function checkControlNames(page: Page): Promise<void> {
  for (const role of ["button", "link"] as const) {
    await expect(page.getByRole(role, { name: /^\s*$/ })).toHaveCount(0);
  }
}

for (const { route } of ROUTES) {
  const pathname = route === NOT_FOUND_PAGE.route ? UNKNOWN_ROUTE : route;
  test(
    `${pathname} fits a 320px window`,
    { tag: "@narrow" },
    async ({ page }, testInfo) => {
      await visit(page, pathname);
      await checkControlNames(page);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      if (capturesRequested)
        await page.screenshot({
          path: testInfo.outputPath(`${pathname.replace(/\//g, "_")}.png`),
          fullPage: true,
        });
    },
  );
}

for (const route of TEMPLATES) {
  test(
    `${route} loads without errors and its controls show focus`,
    { tag: ["@desktop", "@scheme"] },
    async ({ page }) => {
      const errors = watch(page);
      await visit(page, route);
      if (route === SITE_PATHS.docs)
        await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
      await checkFocus(page);
      expect(errors).toEqual([]);
    },
  );
}

// pages/docs/[...slug].astro uses serve for the load watch. Chromium reports
// blocked execution for the sample's intentionally sandboxed srcdoc frames.
test(
  "the docs guide template loads without errors",
  { tag: "@mobile" },
  async ({ page }) => {
    const errors = watch(page);
    await visit(page, "/docs/cli/serve/");
    await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
    expect(errors).toEqual([]);
  },
);

// The sample guide exercises frame and radio focus in the same page template.
// Mobile also covers the Layers and On this page controls.
test(
  "the sample guide's frames and controls show focus",
  { tag: ["@mobile", "@scheme"] },
  async ({ page }) => {
    await visit(page, SAMPLE_GUIDE);
    await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
    await checkFocus(page);
  },
);

// Site.astro supplies the home main. Docs.astro supplies the docs main.
for (const route of [SITE_PATHS.home, SITE_PATHS.docs]) {
  test(
    `${route} starts with the skip link and moves focus to main`,
    { tag: "@desktop" },
    async ({ page }) => {
      await visit(page, route);
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Skip to content" });
      await expect(skip).toBeFocused();
      await expect(skip).toHaveClass("site-skip");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("main")).toBeFocused();
      await expect(page.getByRole("main")).toHaveAttribute("id", "main");
    },
  );
}
