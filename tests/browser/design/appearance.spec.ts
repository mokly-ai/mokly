import { expect, test } from "@playwright/test";

import { designArtboardUrl } from "./artboards.js";

for (const viewport of ["mobile", "desktop"] as const)
  test(`${viewport}: appearance artboards paint their own Light and Dark backgrounds`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    );
    for (const entry of [
      "overview",
      "workspaces/side-by-side",
      "states/light-only",
    ]) {
      for (const [scheme, color] of [
        ["light", "rgb(244, 244, 241)"],
        ["dark", "rgb(22, 21, 18)"],
      ] as const) {
        await page.goto(
          designArtboardUrl(
            `design/browse/appearance/${entry}`,
            viewport,
            scheme,
          ),
        );
        await expect(
          page.locator("[data-mbk-appearance] .mbk-shell"),
        ).toHaveCSS("background-color", color);
      }
    }
  });
