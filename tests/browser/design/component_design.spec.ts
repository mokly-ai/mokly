import { expect, test } from "@playwright/test";

import { componentDesignRoutes, designArtboardUrl } from "./artboards.js";

for (const viewport of ["desktop", "mobile"] as const) {
  test.describe(`${viewport} component designs`, () => {
    test.use({
      viewport:
        viewport === "mobile"
          ? { width: 390, height: 844 }
          : { width: 1440, height: 1000 },
    });

    test("every owning artboard keeps bounded panel scrolling and fits its width", async ({
      page,
    }, testInfo) => {
      for (const route of componentDesignRoutes) {
        await page.goto(designArtboardUrl(route, viewport));
        await expect(page.locator(".mbk-screen-head h2"), route).toHaveCount(1);
        await expect(page.locator(".mbk-screen-head h2"), route).toBeVisible();
        for (const panel of await page
          .locator(".ce-workspace details[open] > .ce-inspector-panel")
          .all())
          await expect(
            panel,
            `${route} keeps bounded panel scrolling`,
          ).toHaveCSS("overflow-y", "auto");
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          ),
          `${route} has no document overflow`,
        ).toBe(false);
        await page.screenshot({
          path: testInfo.outputPath(`${route.replaceAll("/", "-")}.png`),
          fullPage: true,
        });
      }
    });

    test("saved variants keep one visible component canvas", async ({
      page,
    }) => {
      for (const route of [
        "design/components/overview",
        "design/components/pages/variants",
      ]) {
        await page.goto(designArtboardUrl(route, viewport));
        await expect(page.locator(".ce-canvas:visible")).toHaveCount(1);
      }
    });

    test("viewport controls accept keyboard focus", async ({ page }) => {
      await page.goto(
        designArtboardUrl("design/components/overview", viewport),
      );
      const selection = page.getByRole("combobox", {
        name: "Preview viewport",
      });
      await selection.focus();
      await expect(selection).toBeFocused();
    });
  });
}
