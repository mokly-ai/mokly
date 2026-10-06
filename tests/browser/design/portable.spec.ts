import { expect, test } from "@playwright/test";

import { designArtboardUrl } from "./artboards.js";

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: link adaptation preserves row hit areas, colors, and toolbar dimensions`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "mobile"
        ? { width: 390, height: 1000 }
        : { width: 1440, height: 1000 },
    );
    await page.goto(designArtboardUrl("design/browse/views/screen", viewport));
    await page.goto(
      designArtboardUrl("design/changes/diff-controls/current", viewport),
    );
    const toolbar = page.getByRole("group", { name: "Comparison mode" });
    const side = toolbar.getByRole("link", { name: "Side by side" });
    const sideBounds = await side.boundingBox();
    expect((sideBounds?.width ?? 0) > 70).toBe(true);
    await page.goto(designArtboardUrl("design/browse/views/screen", viewport));
    if (viewport === "desktop") {
      const row = page.locator(".mbk-nav-row.active");
      await expect(row).toHaveCSS("display", "flex");
      await expect(row).toHaveCSS("color", "rgb(255, 255, 255)");
      const bounds = await row.boundingBox();
      expect(bounds?.width).toBeGreaterThan(180);
      await row.click({ position: { x: (bounds?.width ?? 200) - 5, y: 12 } });
      await expect(page).toHaveURL(
        designArtboardUrl("design/browse/views/screen", viewport),
      );
    }
    await page.goto(
      designArtboardUrl("design/browse/views/screen", viewport, "dark"),
    );
    const link = page.locator(".mbk-shot-link:visible").first();
    await link.focus();
    await expect(link).toHaveCSS("outline-style", "solid");
    await expect(link).toHaveCSS("color", "rgb(127, 174, 149)");
    await page.screenshot({
      path: `.context/design-dark-focus-${viewport}.png`,
      fullPage: true,
    });
  });
}
