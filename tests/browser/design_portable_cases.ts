import path from "node:path";

import { expect } from "@playwright/test";

import { canvasColor } from "../helpers/design_palette.js";
import { repositoryRoot } from "../helpers/fixture.js";

import { test as baseTest } from "./browser_test.js";
import { registerCanvasCases } from "./design_canvas_cases.js";
import { designFileUrl as servedDesignFileUrl } from "./design_fixture.js";
import { CATALOGUE_LINKS } from "./design_links_cases.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

/** Run the same assertions against each catalogue delivery. */
export function registerDesignPortable(
  test = baseTest,
  mode: "serve" | "static" = "serve",
) {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const designFileUrl =
    mode === "static" ? copiedDesignFileUrl : servedDesignFileUrl;
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
      // The flow-step link keeps the older use-case design until the Canvas
      // family draws a use case. Its Details step opens the Canvas artboard
      // of Details.
      await page.goto(design("design/browse/views/use-case", viewport));
      await page.locator(".flow-step-link").nth(1).click();
      await expect(page).toHaveURL(
        design("design/canvas/outcomes/added", viewport),
      );
      await context.close();
    });

    test(`${viewport}: a focused portable link draws the dark focus ring`, async ({
      page,
    }) => {
      await page.setViewportSize(
        viewport === "mobile"
          ? { width: 390, height: 1000 }
          : { width: 1440, height: 1000 },
      );
      await page.goto(design("design/canvas/overview", `${viewport}.dark`));
      const link = page.getByRole("link", { name: "Mokly", exact: true });
      await link.focus();
      await expect(link).toHaveCSS("outline-style", "solid");
      await expect(link).toHaveCSS(
        "outline-color",
        await canvasColor("dark", "--cv-signal-deep"),
      );
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
