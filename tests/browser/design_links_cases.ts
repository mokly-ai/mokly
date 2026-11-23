import { expect, type Locator, type Page } from "@playwright/test";

import { test as baseTest } from "./browser_test.js";
import { unexpectedDesignScripts as servedScripts } from "./design_fixture.js";
import {
  canvasFrame,
  chooseViewport,
  expectCanvasViewport,
} from "./workspace_actions.js";

/**
 * The Canvas overview's link that opens the catalogue artboard, and that
 * artboard's link back: the compact form's dock and the catalogue sheet's
 * close control, and the desktop catalogue's Changes and All filters.
 */
export const CATALOGUE_LINKS = {
  mobile: { open: "Catalogue", close: "Close catalogue" },
  desktop: { open: /^Changes \d+$/u, close: "All" },
} as const;

/** Run the same assertions against each catalogue delivery. */
export function registerDesignLinks(
  test = baseTest,
  mode: "serve" | "static" = "serve",
) {
  const unexpectedDesignScripts = () =>
    mode === "static"
      ? 'script:not([src="/mokly-viewer/client/frame-probe.js"])'
      : servedScripts();
  async function tabTo(page: Page, link: Locator): Promise<void> {
    for (let step = 0; step < 50; step += 1) {
      await page.keyboard.press("Tab");
      if (await link.evaluate((node) => node === document.activeElement))
        return;
    }
    throw new Error("Design link was not reachable with Tab");
  }

  async function expectFrameRoute(
    page: Page,
    viewport: "mobile" | "desktop",
    entryPath: string,
  ): Promise<void> {
    await expect(page.locator(canvasFrame(viewport))).toHaveAttribute(
      "src",
      `/static/mokly-generated/${entryPath}/index.${viewport}.html`,
    );
  }

  for (const viewport of ["mobile", "desktop"] as const) {
    test(`${viewport} design navigation updates Browse history, selection, and retains the outer viewport`, async ({
      page,
    }) => {
      const links = CATALOGUE_LINKS[viewport];
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto("/view/design/canvas/stage/home/");
      await chooseViewport(page, viewport);
      const frame = page.frameLocator(canvasFrame(viewport));
      await frame
        .getByRole("link", { name: "Open the first screen", exact: true })
        .click();
      await expect(page).toHaveURL(/\/view\/design\/canvas\/overview\/$/);
      await expectFrameRoute(page, viewport, "design/canvas/overview");
      const catalogue = frame.getByRole("link", {
        name: links.open,
        exact: true,
      });
      await frame.getByRole("link", { name: "Mokly", exact: true }).focus();
      await tabTo(page, catalogue);
      // Keyboard focus shows the focus glow of decision 38, not an outline.
      await expect(catalogue).toHaveCSS("outline-style", "none");
      await expect(catalogue).not.toHaveCSS("box-shadow", "none");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(
        /\/view\/design\/canvas\/stage\/catalogue\/$/,
      );
      await expectFrameRoute(page, viewport, "design/canvas/stage/catalogue");
      const row = page.locator(
        'a[data-nav-row][data-route="design/canvas/stage/catalogue/index.html"]',
      );
      await expect(row).toHaveAttribute("aria-current", "page");
      await expect(row).toBeVisible();
      await expectCanvasViewport(page, viewport);
      await page.goBack();
      await expect(page).toHaveURL(/\/view\/design\/canvas\/overview\/$/);
      await expectFrameRoute(page, viewport, "design/canvas/overview");
      await expect(catalogue).toBeVisible();
      await page.goForward();
      await expect(row).toHaveAttribute("aria-current", "page");
      await expectFrameRoute(page, viewport, "design/canvas/stage/catalogue");
      await frame.getByRole("link", { name: links.close, exact: true }).click();
      await expect(page).toHaveURL(/\/view\/design\/canvas\/overview\/$/);
      await expect(frame.locator(unexpectedDesignScripts())).toHaveCount(0);
      const iframe = page.locator(canvasFrame(viewport));
      expect(
        (await iframe.getAttribute("sandbox"))?.split(/\s+/),
      ).not.toContain("allow-scripts");
      await expectCanvasViewport(page, viewport);
    });
  }
}
