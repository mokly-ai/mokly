import { expect, test } from "@playwright/test";

import { designArtboardUrl } from "./artboards.js";

const pickerDesigns = [
  "design/browse/views/screen/tag-picker",
  "design/browse/states/tag-filter",
  "design/browse/views/screen/tag-forms",
  "design/browse/views/screen/tag-onboarding-picker",
];

const barDesigns = [
  ["design/browse/views/screen", 440],
  ["design/browse/appearance/states/auto", 366],
  ["design/browse/appearance/overview", 366],
] as const;

for (const viewport of ["desktop", "mobile"] as const) {
  test(`${viewport}: the changed-view indicator is painted on Appearance`, async ({
    page,
  }) => {
    await page.goto(
      designArtboardUrl("design/browse/variants/changed-views", viewport),
    );
    const appearance = page.locator(".mbk-appearance");
    const mark = appearance.locator('[data-view-changed="scheme"]');
    await expect(mark).toBeVisible();
    await expect(mark).toHaveCSS("background-color", "rgb(79, 120, 100)");
    await expect(mark).toHaveCSS("width", "6px");
    await expect(
      appearance.getByLabel("Appearance", { exact: true }),
    ).toHaveAccessibleDescription("Other theme changed");
  });

  test(`${viewport}: the tag picker panel escapes the search field it anchors to`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    );
    for (const route of pickerDesigns) {
      await page.goto(designArtboardUrl(route, viewport));
      const panel = page.locator(".mbk-tag-picker");
      if ((await panel.count()) === 0) continue;
      const chip = panel.locator(".mbk-chip").first();
      const box = (await chip.boundingBox())!;
      const reached = await page.evaluate(
        ({ x, y }) =>
          document.elementFromPoint(x, y)?.closest(".mbk-tag-picker") instanceof
          HTMLElement,
        { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      );
      expect(reached, `${route}: the picker panel is clipped`).toBe(true);
    }
  });

  test(`${viewport}: the search field keeps its placeholder on one line`, async ({
    page,
  }) => {
    for (const [route, width] of barDesigns) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(designArtboardUrl(route, viewport));
      const search = page.locator(".mbk-search").first();
      const box = (await search.boundingBox())!;
      expect(box.height, `${route}: the query wrapped`).toBeLessThanOrEqual(32);
    }
  });
}
