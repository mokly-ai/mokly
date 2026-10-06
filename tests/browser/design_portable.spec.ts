import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

const design = (entryPath: string, viewport: string) =>
  pathToFileURL(
    path.join(
      repositoryRoot,
      "examples/basic/generated",
      entryPath,
      `index.${viewport}.html`,
    ),
  ).href;

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: link adaptation preserves row hit areas, colors, and toolbar dimensions`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "mobile"
        ? { width: 390, height: 1000 }
        : { width: 1440, height: 1000 },
    );
    await page.goto(design("design/browse/views/screen", viewport));
    await page.goto(design("design/changes/diff-controls/current", viewport));
    const toolbar = page.getByRole("group", { name: "Comparison mode" });
    const current = toolbar.getByText("Current", { exact: true });
    const side = toolbar.getByRole("link", { name: "Side by side" });
    const currentBounds = await current.boundingBox();
    const sideBounds = await side.boundingBox();
    expect(currentBounds?.height).toBe(sideBounds?.height);
    expect((sideBounds?.width ?? 0) > 70).toBe(true);
    await page.goto(design("design/browse/views/screen", viewport));
    if (viewport === "desktop") {
      const row = page.locator(".mbk-nav-row.active");
      await expect(row).toHaveCSS("display", "flex");
      await expect(row).toHaveCSS("color", "rgb(255, 255, 255)");
      const bounds = await row.boundingBox();
      expect(bounds?.width).toBeGreaterThan(180);
      await row.click({ position: { x: (bounds?.width ?? 200) - 5, y: 12 } });
      await expect(page).toHaveURL(
        design("design/browse/views/screen", viewport),
      );
    }
    await page.goto(design("design/browse/views/screen", `${viewport}.dark`));
    const link = page.locator(".mbk-shot-link:visible").first();
    await link.focus();
    await expect(link).toHaveCSS("outline-style", "solid");
    await expect(link).toHaveCSS("color", "rgb(127, 174, 149)");
    await page.screenshot({
      path: `.context/design-dark-focus-${viewport}.png`,
      fullPage: true,
    });
    for (const route of [
      "design/changes/outcomes/removed",
      "design/changes/impact/empty",
    ]) {
      await page.goto(design(route, viewport));
      await expect(page.locator(".mbk-cmp-toolbar a")).toHaveCount(0);
      for (const control of await page
        .locator(".mbk-pathchip, .mbk-search-tag")
        .all())
        await expect(control).not.toHaveAttribute("tabindex");
    }
  });
}
