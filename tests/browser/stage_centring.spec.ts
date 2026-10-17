import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { copiedStaticUrl } from "./static_test.js";
import { chooseViewport } from "./workspace_actions.js";

for (const delivery of ["serve", "static"] as const) {
  test(`${delivery}: overflowing component rows start at the stage edge and fitting rows stay centred`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto(
      `${delivery === "static" ? copiedStaticUrl() : ""}/view/example/components/action/`,
    );
    await chooseViewport(page, "both");
    const stage = page.locator(".mbk-component-stage");
    const frames = stage.locator(".mbk-component-canvas:visible");
    await expect(frames).toHaveCount(2);
    const geometry = () =>
      stage.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const canvases = [
          ...element.querySelectorAll<HTMLElement>(".mbk-component-canvas"),
        ]
          .filter((node) => node.offsetWidth > 0)
          .map((node) => node.getBoundingClientRect());
        return {
          left: bounds.left,
          right: bounds.right,
          first: canvases[0]!.left,
          last: canvases.at(-1)!.right,
          width: element.clientWidth,
          scrollWidth: element.scrollWidth,
          scrollLeft: element.scrollLeft,
          padding: parseFloat(getComputedStyle(element).paddingLeft),
        };
      });
    const start = await geometry();
    expect(start.scrollWidth).toBeGreaterThan(start.width);
    expect(start.scrollLeft).toBe(0);
    expect(start.first).toBeGreaterThanOrEqual(start.left);
    expect(start.first - start.left).toBeCloseTo(start.padding, 0);
    await stage.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    const end = await geometry();
    expect(end.scrollLeft).toBeGreaterThan(0);
    expect(end.last).toBeLessThanOrEqual(end.right);
    await chooseViewport(page, "mobile");
    await expect(frames).toHaveCount(1);
    await expect(stage).toHaveJSProperty("scrollLeft", 0);
    const fitting = await geometry();
    expect(fitting.scrollWidth).toBe(fitting.width);
    expect(fitting.first - fitting.left).toBeCloseTo(
      fitting.right - fitting.last,
      0,
    );
  });
}
