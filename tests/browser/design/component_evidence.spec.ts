import { expect, test } from "@playwright/test";

import { designArtboardUrl } from "./artboards.js";

for (const viewport of ["desktop", "mobile"] as const) {
  test.describe(`${viewport} comparison evidence`, () => {
    test.use({
      viewport:
        viewport === "desktop"
          ? { width: 1440, height: 1000 }
          : { width: 390, height: 844 },
    });

    test("highlight chips have clear separation from intact outlines", async ({
      page,
    }) => {
      for (const route of [
        "design/components/inspection/inspection-highlight",
        "design/components/inspection/inspection-nested",
        "design/components/inspection/inspection-consumer",
      ]) {
        await page.goto(designArtboardUrl(route, viewport));
        await page
          .getByRole("switch", { name: "Highlight components" })
          .check();
        const regions = page.locator(
          ".ce-preview-view:visible .ce-region, .ce-preview-view:visible .ce-single-highlight",
        );
        expect(await regions.count()).toBeGreaterThan(0);
        for (const region of await regions.all()) {
          const outline = (await region.boundingBox())!;
          const label = (await region.locator(":scope > span").boundingBox())!;
          expect(outline.y - (label.y + label.height)).toBeGreaterThanOrEqual(
            4,
          );
          expect(label.x).toBeGreaterThanOrEqual(outline.x + 4);
          const radii = await region
            .locator(":scope > span")
            .evaluate((node) => {
              const style = getComputedStyle(node);
              return [
                style.borderBottomLeftRadius,
                style.borderBottomRightRadius,
              ];
            });
          expect(radii.every((radius) => parseFloat(radius) > 0)).toBe(true);
        }
      }
    });
  });
}
