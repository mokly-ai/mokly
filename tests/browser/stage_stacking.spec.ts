import { expect, test } from "@playwright/test";

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
  await expect(stage).toHaveCSS("justify-content", "flex-start");
});
