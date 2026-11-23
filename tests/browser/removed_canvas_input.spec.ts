import { expect } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import { comparisonIndex, snapshotOf } from "./comparison_ui.js";
import { historicalFrame } from "./previous_version.js";

/** The canvas places the section on whole pixels, so lengths agree to 2px. */
function near(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(2);
}

test("⌘ or Ctrl with the wheel over a previous version's frame zooms the canvas about the pointer", async ({
  page,
  request,
  baseURL,
}) => {
  const snapshot = snapshotOf(
    await comparisonIndex(request, baseURL),
    comparisonPaths.removedScreen,
  );
  await page.goto(
    `/view/${comparisonPaths.removedScreen}/?snapshot=${snapshot}`,
  );
  const frame = historicalFrame(page, "desktop").locator("iframe");
  await expect(frame.contentFrame().locator("h1")).toHaveText(
    "Historical screen",
  );
  const before = (await frame.boundingBox())!;
  const pointer = {
    x: before.x + before.width * 0.3,
    y: before.y + before.height * 0.6,
  };
  // No adapter names a previous version's frame, so the canvas zooms about
  // the point in the frame under the pointer.
  await page.mouse.move(pointer.x, pointer.y);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -60);
  await page.keyboard.up("Control");
  await expect
    .poll(async () => (await frame.boundingBox())!.width)
    .toBeGreaterThan(before.width * 1.2);
  const after = (await frame.boundingBox())!;
  const factor = after.width / before.width;
  near(pointer.x - after.x, (pointer.x - before.x) * factor);
  near(pointer.y - after.y, (pointer.y - before.y) * factor);
});
