import path from "node:path";

import { expect } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

import { test } from "./browser_test.js";
import { designFileUrl } from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";

/** Run the same assertions against each catalogue delivery. */
export function registerDesignTopBar() {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const directory = path.join(repositoryRoot, "examples/basic/mokly-generated");

  /** The Canvas tag search states whose picker is open under the field. */
  const pickerDesigns = [
    "design/canvas/search/tags",
    "design/canvas/search/tags/forms-picker",
    "design/canvas/search/tags/onboarding-picker",
  ];

  const barDesigns = [
    ["design/canvas/overview", 440],
    ["design/canvas/stage/home", 366],
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
          designFileUrl(path.join(directory, `${route}/index.${viewport}.html`))
            .href,
        );
        const panel = page.locator(".mbk-tag-picker");
        await expect(panel, `${route}: the picker is open`).toHaveCount(1);
        const chip = panel.locator(".mbk-chip").first();
        const box = (await chip.boundingBox())!;
        const reached = await page.evaluate(
          ({ x, y }) =>
            document
              .elementFromPoint(x, y)
              ?.closest(".mbk-tag-picker") instanceof HTMLElement,
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
          designFileUrl(path.join(directory, `${route}/index.${viewport}.html`))
            .href,
        );
        const search = page.locator(".mbk-search").first();
        const box = (await search.boundingBox())!;
        expect(box.height, `${route}: the query wrapped`).toBeLessThanOrEqual(
          32,
        );
      }
    });
  }
}
