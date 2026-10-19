/**
 * A light-only saved variant under a Dark selection on the copied comparison
 * output, under the comparison modes contract: the variant's status, its
 * comparison band, and its marks follow the Light views that it displays,
 * and no frame loads a dark document.
 */

import { expect } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";

test("a light-only saved variant uses its displayed scheme for status and marks", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.lightOnlyVariant}/?scheme=dark`);
  await expect(page.locator("#mb-main h2").first()).toHaveText("Lamp");
  await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
  await expect(page.locator(".mbk-diff-toolbar")).toBeVisible();
  await expect(
    page.locator("[data-mokly-appearance-select], [data-workspace-scheme]"),
  ).not.toHaveCount(0);
  await expect(page.locator('[data-view-changed="scheme"]')).toBeHidden();
  const frames = page.locator("iframe[data-workspace-frame]");
  await expect(frames).not.toHaveCount(0);
  for (const frame of await frames.all()) {
    await expect(frame).toHaveAttribute("src", /\.html$/u);
    await expect(frame).not.toHaveAttribute("src", /\.dark\.html$/u);
  }
});
