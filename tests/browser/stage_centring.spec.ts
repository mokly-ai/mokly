/**
 * Below the layout breakpoint the compact layout fits a variant set's rows
 * across the stage from its top, so its first and last frames stay on the
 * stage, as the canvas fits and centres the set from 900px wide. A saved
 * variant's route shows that row's frame alone, centred across the stage.
 */

import { expect, type Page } from "@playwright/test";

import { FIT_MARGIN } from "../../packages/ui/src/canvas-stage/canvas-view.js";

import { test } from "./browser_test.js";
import { copiedStaticUrl } from "./static_test.js";
import { NARROW_WINDOW } from "./workspace_actions.js";

/** The section's distance from each edge of the stage. */
function insets(page: Page) {
  return page.locator("[data-mokly-stage]").evaluate((canvas) => {
    const box = (selector: string) =>
      canvas.querySelector(selector)!.getBoundingClientRect();
    const stage = box(".mbk-canvas-stage");
    const section = box(".mbk-canvas-section");
    return {
      bottom: stage.bottom - section.bottom,
      left: section.left - stage.left,
      right: stage.right - section.right,
      top: section.top - stage.top,
    };
  });
}

/** Whether the section stands on the stage, centred across it, at its top. */
async function centredAtTop(page: Page): Promise<boolean> {
  const { bottom, left, right, top } = await insets(page);
  return (
    Math.abs(left - right) <= 1 &&
    Math.min(left, right, bottom) >= FIT_MARGIN - 1 &&
    Math.abs(top - FIT_MARGIN) <= 1
  );
}

for (const delivery of ["serve", "static"] as const) {
  test(`${delivery}: below the layout breakpoint, a variant set's rows fit across the stage from its top, and a saved variant's frame stays centred`, async ({
    page,
  }) => {
    const origin = delivery === "static" ? copiedStaticUrl() : "";
    await page.setViewportSize(NARROW_WINDOW);
    await page.goto(`${origin}/view/example/components/action/`);
    const shown = page.locator(
      "[data-mokly-stage] .mbk-canvas-cell:not([hidden]) iframe",
    );
    await expect(shown).toHaveCount(8);
    await expect(
      shown.and(page.locator('[data-mokly-frame-state="ready"]')),
    ).toHaveCount(8);
    // The frames take their measured sizes, and the canvas fits them again.
    await expect.poll(() => centredAtTop(page)).toBe(true);

    await page.goto(`${origin}/view/example/components/action/disabled/`);
    await expect(shown).toHaveCount(1);
    await expect(shown).toHaveAttribute("data-mokly-frame-state", "ready");
    await expect.poll(() => centredAtTop(page)).toBe(true);
  });
}
