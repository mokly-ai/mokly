import path from "node:path";

import { expect, type Browser, type Page } from "@playwright/test";

import { viewHref, viewRoute } from "../../packages/viewer/dist/data.js";
import { repositoryRoot } from "../helpers/fixture.js";

import { test as baseTest } from "./browser_test.js";
import { designCases, designCatalogue } from "./design_catalogue.js";
import {
  assertDesignResource,
  designFileUrl as servedDesignFileUrl,
  designResourceExists,
} from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

/**
 * Run one viewport's assertions against a catalogue delivery. Each viewport
 * has its own spec file, because Playwright gives a whole spec file to one
 * browser shard and the shard balance limit bounds each shard's share.
 */
export function registerDesignLibrary(
  viewport: "desktop" | "mobile",
  test = baseTest,
  mode: "serve" | "static" = "serve",
) {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const designFileUrl =
    mode === "static" ? copiedDesignFileUrl : servedDesignFileUrl;
  const generated = path.join(repositoryRoot, "examples/basic/mokly-generated");
  const manifest = { entries: designCatalogue(test) };
  const fileUrl = (route: string) =>
    designFileUrl(path.join(generated, route)).href;
  const size =
    viewport === "mobile"
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1000 };

  /**
   * Reads the shipped viewer on the example's Welcome screen, where the shell
   * draws the same `@mokly/ui` parts as the samples, in the samples'
   * viewport. The shell's script draws it, so it opens in its own context
   * with JavaScript on, while each sample stays static.
   */
  async function inShell<T>(
    browser: Browser,
    origin: string,
    read: (shell: Page) => Promise<T>,
  ): Promise<T> {
    const context = await browser.newContext({
      baseURL: origin,
      javaScriptEnabled: true,
      viewport: size,
    });
    try {
      const shell = await context.newPage();
      await shell.goto(viewHref("example/screens/welcome"));
      return await read(shell);
    } finally {
      await context.close();
    }
  }

  test.describe(`${viewport} shared design library`, () => {
    test.use({ javaScriptEnabled: false, viewport: size });

    for (const entry of designCases.filter(
      (entry) =>
        entry.kind === "component" &&
        entry.variantOf &&
        entry.path.startsWith("design/library/"),
    ))
      test(`${entry.path}: saved sample loads with confined styles and links`, async ({
        page,
      }, testInfo) => {
        const failed: string[] = [];
        page.on("requestfailed", (request) => failed.push(request.url()));
        await page.goto(fileUrl(viewRoute(entry.path, viewport, "light")));
        await expect(page.locator(".mbk-library-host")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${entry.variantOf}/${entry.path} fits`,
        ).toBe(true);
        const urls = await page
          .locator("a[href],link[rel=stylesheet]")
          .evaluateAll((nodes) =>
            nodes.map((node) => (node as HTMLAnchorElement).href),
          );
        for (const url of new Set(urls)) {
          await assertDesignResource(url, page.url());
          expect(await designResourceExists(page.request, url), url).toBe(true);
        }
        await page.screenshot({
          path: testInfo.outputPath(`${entry.variantOf}-${entry.path}.png`),
          fullPage: true,
        });
        expect(failed).toEqual([]);
      });

    test("catalogue section headings keep the in-screen typography in isolation", async ({
      baseURL,
      browser,
      page,
    }) => {
      const typography = (on: Page) =>
        on
          .locator(".mbk-nav-section-head")
          .first()
          .evaluate((node) => {
            const style = getComputedStyle(node);
            return {
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              letterSpacing: style.letterSpacing,
              lineHeight: style.lineHeight,
            };
          });
      await page.goto(
        fileUrl(
          `design/library/chrome/catalogue-navigation/all/index.${viewport}.html`,
        ),
      );
      const isolated = await typography(page);
      const inScreen = await inShell(browser, baseURL!, async (shell) => {
        // A phone draws the catalogue in the drawer that its top bar opens.
        if (viewport === "mobile")
          await shell
            .getByRole("button", { name: "Open catalogue navigation" })
            .click();
        await expect(
          shell.locator(".mbk-nav-section-head").first(),
        ).toBeVisible();
        return typography(shell);
      });
      expect(inScreen).toMatchObject({
        fontSize: "10.5px",
        fontWeight: "700",
      });
      expect(isolated).toEqual(inScreen);
    });

    test("the top-bar logo keeps the in-screen colors in isolation", async ({
      baseURL,
      browser,
      page,
    }) => {
      const logo = (on: Page) =>
        on.locator(".mbk-brand").evaluate((brand) => {
          // A wordmark that the narrow bar hides reads as absent.
          const color = (selector: string) => {
            const node = brand.querySelector(selector);
            return node && getComputedStyle(node).display !== "none"
              ? getComputedStyle(node).color
              : null;
          };
          return {
            brand: getComputedStyle(brand).color,
            mark: color(".mbk-mark"),
            rules: getComputedStyle(brand.querySelector(".mbk-mark-rules")!)
              .stroke,
            name: color(".mbk-name"),
          };
        });
      await page.goto(
        fileUrl(`design/library/chrome/top-bar/default/index.${viewport}.html`),
      );
      const isolated = await logo(page);
      const inScreen = await inShell(browser, baseURL!, logo);
      expect(inScreen).toEqual({
        brand: "rgb(13, 20, 16)",
        mark: "rgb(18, 183, 106)",
        rules: "rgb(4, 19, 11)",
        name: viewport === "desktop" ? "rgb(13, 20, 16)" : null,
      });
      expect(isolated).toEqual(inScreen);
    });

    test("standalone inline components retain their intrinsic width", async ({
      page,
    }) => {
      for (const [slug, selector] of [
        ["tag-chip", ".mbk-chip"],
        ["change-status", ".mbk-entry-status"],
      ]) {
        const entry = manifest.entries.find(
          (entry) =>
            entry.kind === "component" &&
            "variantOf" in entry &&
            entry.variantOf === `design/library/controls/${slug}`,
        );
        if (entry?.kind !== "component" || !("variantOf" in entry))
          throw new Error(`Missing ${slug}`);
        await page.goto(fileUrl(viewRoute(entry.path, viewport, "light")));
        expect(
          (await page.locator(selector!).boundingBox())!.width,
        ).toBeLessThan(150);
      }
    });
  });

  if (viewport === "mobile") {
    test("mobile comparison samples fit with wider fallback fonts", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(
        fileUrl(
          "design/library/panels/compare-modes/side-by-side/index.mobile.html",
        ),
      );
      // The Canvas palette scope declares its fonts inline, so the wider
      // fallback outranks that declaration.
      await page.addStyleTag({
        content:
          ".cv { --cv-sans: Verdana, sans-serif !important; --sans: Verdana, sans-serif !important; }",
      });
      const modes = page.getByRole("list", { name: "Comparison mode" });
      await expect(modes.locator(".cv-mode")).toHaveCount(5);
      await expect(modes.locator(".cv-mode-name").first()).toHaveCSS(
        "font-family",
        "Verdana, sans-serif",
      );
      const bounds = await modes.boundingBox();
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(390);
    });
  }
}
