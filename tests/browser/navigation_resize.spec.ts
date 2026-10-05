import { expect, test } from "@playwright/test";

import { loadComparison } from "./comparison_actions.js";
import { comparisonFixture } from "./diffs_fixture.js";
import { chooseViewport } from "./workspace_actions.js";

let fixture: Awaited<ReturnType<typeof comparisonFixture>>;
test.beforeAll(async () => {
  fixture = await comparisonFixture();
});
test.afterAll(async () => {
  await fixture.close();
});

test("Changes keeps resized navigation across diff modes and screen navigation", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1_280 });
  const comparisonRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/__mokly/diffs/"))
      comparisonRequests.push(request.url());
  });
  await page.goto(`${fixture.url}/view/home/`);
  await page.locator('[data-filter="changed"]').click();
  await chooseViewport(page, "desktop");
  const nav = page.locator("[data-mokly-nav]");
  const handle = page.getByRole("separator", {
    name: "Resize navigation panel",
  });
  await expect(handle).toBeVisible();
  const grip = await handle.boundingBox();
  if (!grip) throw new Error("comparison navigation resize bounds unavailable");
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 100);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 64, grip.y + 100);
  await page.mouse.up();
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(312, 0);
  expect(comparisonRequests).toEqual([]);

  await loadComparison(page, "Overlay");
  await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(2);
  await expect(handle).toHaveAttribute("aria-valuenow", "312");
  await handle.focus();
  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(296, 0);
  for (const mode of ["Difference", "Current"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await expect(handle).toBeVisible();
    await expect
      .poll(async () => (await nav.boundingBox())?.width)
      .toBeCloseTo(296, 0);
  }
  await page.locator('[data-filter="all"]').click();
  await page.locator('[data-route="details/index.html"]').click();
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(296, 0);
  await page.reload();
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(296, 0);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.getByRole("button", { name: "Open catalogue navigation" }).click();
  await expect(nav).toBeVisible();
  await expect(handle).toBeHidden();
});
