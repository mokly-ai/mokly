import { expect, type Locator, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import { tabTo } from "./tab_to.js";

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

/** The canvas places the section on whole pixels, so lengths agree to 1px. */
function near(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1.5);
}

/** The Welcome screen's Desktop · Light frame on the canvas. */
function desktopFrame(page: Page): Locator {
  return page.locator(
    'iframe[data-workspace-frame="desktop"][data-workspace-color-scheme="light"]',
  );
}

/** The zoom that the desktop frame shows: its width on screen over 1280. */
async function zoom(page: Page): Promise<number> {
  return (await box(desktopFrame(page))).width / 1280;
}

test("⌘ or Ctrl with the wheel over a frame zooms the canvas about the pointer, and the keys work while focus is inside a frame", async ({
  page,
}) => {
  await page.goto("/view/example/screens/welcome/");
  const frame = desktopFrame(page);
  await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
  const pill = page.getByRole("group", { name: "Zoom" });
  const fitted = await zoom(page);
  const before = await box(frame);
  const pointer = {
    x: before.x + before.width * 0.3,
    y: before.y + before.height * 0.6,
  };
  // The frame's document forwards the wheel, which never reaches the canvas
  // itself, and keeps the page's own zoom.
  await page.mouse.move(pointer.x, pointer.y);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -100);
  await page.keyboard.up("Control");
  await expect.poll(() => zoom(page)).toBeCloseTo(fitted * Math.exp(0.8), 2);
  // The frame's point under the pointer stays under it.
  const after = await box(frame);
  const factor = after.width / before.width;
  near(pointer.x - after.x, (pointer.x - before.x) * factor);
  near(pointer.y - after.y, (pointer.y - before.y) * factor);

  // Focus moves into the frame's document, which forwards the canvas keys
  // from each element that does not take text: its Workspace name field
  // comes first, and the link after it.
  await tabTo(
    page,
    page.locator("[data-mokly-stage]").getByRole("button", {
      name: "Copy path example/screens/welcome",
      exact: true,
    }),
  );
  await page.keyboard.press("Tab");
  const focused = frame.contentFrame().locator(":focus");
  await expect(focused).toHaveAttribute("aria-label", "Workspace name");
  await page.keyboard.press("Equal");
  await page.keyboard.press("Tab");
  await expect(focused).toHaveJSProperty("localName", "a");
  await expect(frame).toBeFocused();
  // The field kept its key: the zoom has not changed.
  expect(await zoom(page)).toBeCloseTo(fitted * Math.exp(0.8), 2);
  const zoomed = await zoom(page);
  await page.keyboard.press("Equal");
  await expect.poll(() => zoom(page)).toBeCloseTo(zoomed * 1.25, 2);
  await page.keyboard.press("Minus");
  await expect.poll(() => zoom(page)).toBeCloseTo(zoomed, 2);
  await page.keyboard.press("Shift+Digit0");
  await expect(pill).toContainText("100%");
  await page.keyboard.press("Shift+Digit1");
  await expect.poll(() => zoom(page)).toBeCloseTo(fitted, 2);
  await expect(frame).toBeFocused();
});
