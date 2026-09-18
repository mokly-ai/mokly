import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

const directory = path.join(repositoryRoot, "examples/basic/generated");

const pickerDesigns = [
  "design/browse/states/tags/picker",
  "design/browse/states/tag-filter",
  "design/browse/states/tags/forms",
  "design/browse/states/tags/onboarding-picker",
];

const barDesigns = [
  ["design/browse/views/screen", 440],
  ["design/browse/appearance/states/auto", 366],
  ["design/browse/appearance/overview", 366],
] as const;

for (const viewport of ["desktop", "mobile"] as const) {
  test(`${viewport}: the tag picker panel escapes the search field it anchors to`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    );
    for (const route of pickerDesigns) {
      await page.goto(
        pathToFileURL(path.join(directory, `${route}.${viewport}.html`)).href,
      );
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
      await page.goto(
        pathToFileURL(path.join(directory, `${route}.${viewport}.html`)).href,
      );
      const search = page.locator(".mbk-search").first();
      const box = (await search.boundingBox())!;
      expect(box.height, `${route}: the query wrapped`).toBeLessThanOrEqual(32);
    }
  });
}
