import { type Page, expect, test } from "@playwright/test";

import { DOCS_PAGES } from "../../src/docs/pages.js";
import { NOT_FOUND_ROUTE } from "../../src/metadata.js";
import { SITE_PATHS } from "../../src/navigation.js";

import { assertFocusGlow } from "./accessibility.js";
import { PAGES } from "./routes.js";

const UNKNOWN_ROUTE = "/does-not-exist/";
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
  `${NOT_FOUND_ROUTE}.html`,
];

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
  for (const role of ["button", "link"] as const) {
    await expect(page.getByRole(role, { name: /^\s*$/ })).toHaveCount(0);
  }
}

for (const route of [...PAGES, ...DOCS_PAGES]
  .map(({ route }) => route)
  .concat(UNKNOWN_ROUTE)) {
  test(
    `${route} fits a 320px window`,
    { tag: "@narrow" },
    async ({ page }, testInfo) => {
      const response = await page.goto(route);
      if (route === UNKNOWN_ROUTE) expect(response?.status()).toBe(404);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      if (capturesRequested)
        await page.screenshot({
          path: testInfo.outputPath(`${route.replace(/\//g, "_")}.png`),
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
      await page.goto(route);
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
    await page.goto("/docs/cli/serve/");
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
    await page.goto(SAMPLE_GUIDE);
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
      await page.goto(route);
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
