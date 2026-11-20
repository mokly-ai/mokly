import { expect } from "@playwright/test";

import { test } from "./browser_test.js";

test("stacked frames on a narrow stage start at its top so the first frame stays reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/view/example/screens/welcome/");
  const stage = page.locator(".mbk-stage");
  const label = stage.locator(".mbk-frame-mobile .mbk-frame-label");
  await expect(label).toHaveText("Mobile");
  await expect(stage).toHaveJSProperty("scrollTop", 0);
  const [stageTop, labelTop] = await Promise.all([
    stage.evaluate((element) => element.getBoundingClientRect().top),
    label.evaluate((element) => element.getBoundingClientRect().top),
  ]);
  expect(labelTop).toBeGreaterThanOrEqual(stageTop);

  // A fitting column distinguishes top alignment from safe centring.
  await page.setViewportSize({ width: 390, height: 1800 });
  await expect(stage.locator(".mbk-frame-wrap:visible")).toHaveCount(2);
  await expect(stage).toHaveCSS("flex-direction", "column");
  const geometry = () =>
    stage.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const paddingTop = parseFloat(style.paddingTop);
      const frames = [
        ...element.querySelectorAll<HTMLElement>(".mbk-frame-wrap"),
      ].filter((frame) => frame.offsetHeight > 0);
      const first = frames[0]!.getBoundingClientRect();
      const last = frames.at(-1)!.getBoundingClientRect();
      return {
        spareHeight:
          element.clientHeight -
          paddingTop -
          parseFloat(style.paddingBottom) -
          (last.bottom - first.top),
        startOffset:
          first.top +
          element.scrollTop -
          bounds.top -
          parseFloat(style.borderTopWidth) -
          paddingTop,
      };
    });
  await expect
    .poll(async () => (await geometry()).spareHeight)
    .toBeGreaterThan(100);
  await expect
    .poll(async () => (await geometry()).startOffset)
    .toBeCloseTo(0, 0);
});
