import { expect } from "@playwright/test";

import { staticRequests } from "./static_delivery_assertions.js";
import { test } from "./static_test.js";
import { chooseViewport } from "./workspace_actions.js";

test("copied catalogue navigation retains pointer and keyboard resizing", async ({
  page,
}) => {
  const requests = staticRequests(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/view/example/screens/welcome/");
  const divider = page.getByRole("separator", {
    name: "Resize navigation panel",
  });
  await expect(divider).toBeVisible();
  const width = () => divider.getAttribute("aria-valuenow").then(Number);
  const initial = await width();
  await divider.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(width).toBe(initial + 16);
  const box = (await divider.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  expect(await width()).toBeGreaterThan(initial + 16);
  await divider.focus();
  await page.keyboard.press("Home");
  await expect.poll(width).toBe(192);
  await page.keyboard.press("End");
  await expect.poll(width).toBe(480);
  requests.assert();
});

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: copied page-design inspector links preserve canonical outer navigation`, async ({
    page,
  }) => {
    await page.goto("/view/design/browse/pages/view/");
    await chooseViewport(page, viewport);
    const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
    await frame.locator(".ce-inspector-link").click();
    await expect(page).toHaveURL(/\/view\/design\/browse\/pages\/details\/$/);
    await frame.locator(".ce-inspector-link").click();
    await expect(page).toHaveURL(/\/view\/design\/browse\/pages\/view\/$/);
    await frame
      .getByRole("link", { name: "Open Welcome", exact: true })
      .click();
    await expect(page).toHaveURL(/\/view\/design\/browse\/views\/screen\/$/);
    await expect(page.locator("[data-mokly-stage]")).toHaveAttribute(
      "data-viewport",
      viewport,
    );
  });
}
