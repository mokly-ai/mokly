import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import {
  canvasFrame,
  chooseViewport,
  closeOpenSheet,
  NARROW_WINDOW,
} from "./workspace_actions.js";

export function registerPhoneChrome() {
  // Below the layout breakpoint the compact layout shows the one frame, and
  // from it up the canvas shows every frame; neither draws a phone.
  for (const width of [390, NARROW_WINDOW.width, 1280]) {
    test(`a canvas frame has no device decoration and leaves its preview hit-testable at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/view/example/screens/welcome/");
      await chooseViewport(page, "mobile");
      // The compact layout's panel sheet, which holds the viewport choice,
      // closes again before the hit test.
      await closeOpenSheet(page);
      const frame = page.locator(canvasFrame("mobile"));
      await expect(frame).toBeVisible();
      // The frame's centre hits its own preview, and nothing drawn over it.
      const hit = await frame.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        return (
          document.elementFromPoint(
            bounds.x + bounds.width / 2,
            bounds.y + bounds.height / 2,
          ) === node
        );
      });
      expect(hit).toBe(true);
    });
  }
}
