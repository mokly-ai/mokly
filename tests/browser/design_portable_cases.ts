import path from "node:path";

import { expect } from "@playwright/test";

import { canvasColor } from "../helpers/design_palette.js";
import { repositoryRoot } from "../helpers/fixture.js";

import { test } from "./browser_test.js";
import { registerCanvasCases } from "./design_canvas_cases.js";
import { designFileUrl } from "./design_fixture.js";
import { CATALOGUE_LINKS } from "./design_links_cases.js";
import { documentFavicon } from "./document_error_allowance.js";

/** Run the same assertions against each catalogue delivery. */
export function registerDesignPortable() {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const design = (entryPath: string, viewport: string) =>
    designFileUrl(
      path.join(
        repositoryRoot,
        "examples/basic/mokly-generated",
        entryPath,
        `index.${viewport}.html`,
      ),
    ).href;
  registerCanvasCases(test, design);

  test("desktop: the selected catalogue row keeps its full hit area and color as a portable link", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(design("design/canvas/overview", "desktop"));
    const row = page.locator('.mbk-nav-row[aria-current="page"]');
    await expect(row).toHaveCSS("display", "flex");
    await expect(row).toHaveCSS(
      "color",
      await canvasColor("light", "--cv-text"),
    );
    const bounds = await row.boundingBox();
    expect(bounds?.width).toBeGreaterThan(180);
    await row.click({ position: { x: (bounds?.width ?? 200) - 5, y: 12 } });
    await expect(page).toHaveURL(design("design/canvas/overview", "desktop"));
  });

  for (const viewport of ["mobile", "desktop"] as const) {
    test(`${viewport}: portable design links work without Browse enhancement`, async ({
      browser,
    }) => {
      const links = CATALOGUE_LINKS[viewport];
      const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport:
          viewport === "mobile"
            ? { width: 390, height: 1000 }
            : { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      const link = (name: string | RegExp) =>
        page.getByRole("link", { name, exact: true });
      await page.goto(design("design/canvas/stage/home", viewport));
      await link("Open the first screen").click();
      await expect(page).toHaveURL(design("design/canvas/overview", viewport));
      await link(links.open).click();
      await expect(page).toHaveURL(
        design("design/canvas/stage/catalogue", viewport),
      );
      await link(links.close).click();
      await expect(page).toHaveURL(design("design/canvas/overview", viewport));
      await link("Filter by tag").click();
      await expect(page).toHaveURL(
        design("design/canvas/search/tags", viewport),
      );
      await page
        .getByRole("group", { name: "Tags", exact: true })
        .getByRole("link", { name: "onboarding", exact: true })
        .click();
      await expect(page).toHaveURL(
        design("design/canvas/search/tags/onboarding", viewport),
      );
      await link("Filter by tag").click();
      await expect(page).toHaveURL(
        design("design/canvas/search/tags/onboarding-picker", viewport),
      );
      await page.getByRole("link", { name: "Close tag picker" }).click();
      await expect(page).toHaveURL(
        design("design/canvas/search/tags/onboarding", viewport),
      );
      // The use case's second step, which a phone shows once the frame
      // picker picks it, opens the Canvas artboard of Details.
      await page.goto(design("design/canvas/flows/tour/second-step", viewport));
      await page
        .locator(".cv-frames")
        .getByRole("link", { name: "Details", exact: true })
        .click();
      await expect(page).toHaveURL(
        design("design/canvas/outcomes/added", viewport),
      );
      await context.close();
    });

    test(`${viewport}: a focused portable link draws the dark focus glow`, async ({
      page,
    }) => {
      await page.setViewportSize(
        viewport === "mobile"
          ? { width: 390, height: 1000 }
          : { width: 1440, height: 1000 },
      );
      await page.goto(design("design/canvas/overview", `${viewport}.dark`));
      // The glow of decision 38: a 4px halo of the dark signal at 75%, as a
      // probe on the artboard's root computes it.
      const glow = await page
        .locator(".cv")
        .first()
        .evaluate((root) => {
          const probe = document.createElement("span");
          probe.style.boxShadow =
            "0 0 0 4px color-mix(in srgb, var(--cv-signal-deep) 75%, transparent)";
          root.append(probe);
          const shadow = getComputedStyle(probe).boxShadow;
          probe.remove();
          return shadow;
        });
      const link = page.getByRole("link", { name: "Mokly", exact: true });
      await link.focus();
      await expect(link).toHaveCSS("outline-style", "none");
      await expect(link).toHaveCSS("box-shadow", glow);
      await expect(link).toHaveCSS(
        "color",
        await canvasColor("dark", "--cv-text"),
      );
      await page.screenshot({
        path: `.context/design-dark-focus-${viewport}.png`,
        fullPage: true,
      });
    });
  }
}
