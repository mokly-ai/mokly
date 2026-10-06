import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

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
        const file = path.join(
          repositoryRoot,
          "examples/basic/generated",
          `design/browse/appearance/${entry}/index.${viewport}${scheme === "dark" ? ".dark" : ""}.html`,
        );
        await page.goto(pathToFileURL(file).href);
        await expect(
          page.locator("[data-mbk-appearance] .mbk-shell"),
        ).toHaveCSS("background-color", color);
      }
    }
  });
