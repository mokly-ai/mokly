/**
 * A copy whose catalogue rendered Light only at the branch point and renders
 * Light and Dark now. The removed Old terms document has no dark render, so
 * its previous version keeps its light page and names that fallback only
 * under Dark, as `design/browse/appearance/states/light-only-document`
 * depicts.
 */

import { expect } from "@playwright/test";

import {
  addLightOnlyBaseSources,
  lightOnlyPaths as paths,
} from "../helpers/light_only_sources.js";

import { additionsCopyTest } from "./additions_copy_test.js";

const test = additionsCopyTest(
  "browser-light-only-base",
  addLightOnlyBaseSources,
);

for (const width of [390, 1280])
  test(`${width}px: a removed document with no dark render keeps its light version and names it only under Dark`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/view/${paths.removedDocument}/`);
    const appearance = page.getByLabel("Appearance", { exact: true });
    const label = page.locator(".mbk-previous");
    const note = label.locator(".mbk-frame-scheme-note");
    const stage = page.locator(".mbk-stage-embed[data-preview-color-scheme]");
    const heading = page
      .frameLocator("iframe[data-mokly-preview-frame]")
      .getByRole("heading", { name: "Old terms", exact: true });

    await appearance.selectOption("light");
    await expect(heading).toBeVisible();
    await expect(label).toHaveText(/^Showing previous version/u);
    await expect(note).toBeHidden();
    await expect(page.locator(".mbk-scheme-fallback")).toHaveCount(0);

    await appearance.selectOption("dark");
    await expect(note).toBeVisible();
    await expect(label).toHaveText("Showing previous version — Light only");
    await expect(stage).toHaveAttribute("data-preview-color-scheme", "light");
    await expect(heading).toBeVisible();

    await appearance.selectOption("light");
    await expect(note).toBeHidden();
    await expect(heading).toBeVisible();
  });
