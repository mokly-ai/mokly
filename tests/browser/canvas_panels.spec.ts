import { expect, type Locator, type Page } from "@playwright/test";

import { test } from "./browser_test.js";

const WELCOME = "/view/example/screens/welcome/";

/** The canvas places the section on whole pixels, so lengths agree to 1px. */
function near(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
}

/** The box of a shown element, once it shows. */
async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

/** The canvas, the floating catalogue, and the right panel. */
function parts(page: Page) {
  return {
    canvas: page.locator("[data-mokly-stage]"),
    catalogue: page.locator('[data-floating-panel="left"]'),
    panel: page.getByRole("region", { name: "Panel" }),
    section: page.locator(".mbk-canvas-section"),
  };
}

async function openWelcome(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(WELCOME);
  await expect(page.locator("iframe[data-workspace-frame]")).toHaveCount(4);
  await expect(page.getByRole("group", { name: "Zoom" })).toBeVisible();
}

/**
 * Expect the panels to float over the full-bleed canvas, each 8px from its
 * top, bottom and outer edge, at their widths, and the section to stand
 * centred between them, with the zoom pill centred below it.
 */
async function expectFloating(
  page: Page,
  widths: { catalogue: number; panel: number },
): Promise<void> {
  const { canvas, catalogue, panel, section } = parts(page);
  const area = await box(canvas);
  expect(area.x).toBe(0);
  expect(area.width).toBe(page.viewportSize()!.width);
  const left = await box(catalogue);
  const right = await box(panel);
  near(left.x, area.x + 8);
  near(right.x + right.width, area.x + area.width - 8);
  for (const floating of [left, right]) {
    near(floating.y, area.y + 8);
    near(floating.y + floating.height, area.y + area.height - 8);
  }
  near(left.width, widths.catalogue);
  near(right.width, widths.panel);
  for (const floating of [catalogue, panel])
    await expect(floating).toHaveCSS("border-radius", "12px");
  // The stage lies between the panels' widths, margins and 8px gaps.
  const stage = {
    left: area.x + widths.catalogue + 16,
    right: area.x + area.width - widths.panel - 16,
  };
  const placed = await box(section);
  expect(placed.x).toBeGreaterThanOrEqual(stage.left);
  expect(placed.x + placed.width).toBeLessThanOrEqual(stage.right);
  near(placed.x - stage.left, stage.right - placed.x - placed.width);
  const pill = await box(page.getByRole("group", { name: "Zoom" }));
  near(pill.x + pill.width / 2, (stage.left + stage.right) / 2);
}

test("at 1440px the panels float over the canvas, and Fit centres the section between them", async ({
  page,
}) => {
  await openWelcome(page, 1440);
  await expectFloating(page, { catalogue: 252, panel: 312 });
  // The right panel holds the head band and the inspector.
  const panel = parts(page).panel;
  await expect(
    panel.getByRole("heading", { name: "Welcome", exact: true }),
  ).toBeVisible();
  await expect(panel.getByRole("region", { name: "Inspector" })).toBeVisible();
});

test("below 1180px the panels narrow to 224px and 284px", async ({ page }) => {
  await openWelcome(page, 1100);
  await expectFloating(page, { catalogue: 224, panel: 284 });
});

test("the catalogue's resize moves the stage's start inset, and a double click restores the starting width", async ({
  page,
}) => {
  await openWelcome(page, 1440);
  const { catalogue, section } = parts(page);
  const separator = page.getByRole("separator", {
    name: "Resize navigation panel",
  });
  const grip = await box(separator);
  // The separator straddles the floating catalogue's right edge.
  near(grip.x + grip.width / 2, (await box(catalogue)).x + 252);
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 60, grip.y + 40, {
    steps: 4,
  });
  await page.mouse.up();
  await expect.poll(async () => (await box(catalogue)).width).toBe(312);
  await expect(separator).toHaveAttribute("aria-valuenow", "312");
  // The fitted canvas refits into the narrower stage.
  await expect
    .poll(async () => (await box(section)).x)
    .toBeGreaterThanOrEqual(8 + 312 + 8 + 8);
  await expectFloating(page, { catalogue: 312, panel: 312 });
  await page.reload();
  await expect(page.getByRole("group", { name: "Zoom" })).toBeVisible();
  await expect.poll(async () => (await box(catalogue)).width).toBe(312);
  await separator.dblclick();
  await expect.poll(async () => (await box(catalogue)).width).toBe(252);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("mokly:navigation-width:v1"),
    ),
  ).toBeNull();
});

test("with nothing selected the home guidance stands on the canvas, with no right panel and no zoom pill", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const home = page.locator("[data-empty-canvas] > .mbk-empty");
  await expect(home.getByRole("heading", { name: "Mokly" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Panel" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Zoom" })).toHaveCount(0);
  // The card stands centred between the catalogue and the canvas's end.
  const card = await box(home);
  const main = await box(page.getByRole("main"));
  const start = main.x + 252 + 16;
  near(card.x - start, main.x + main.width - card.x - card.width);
});
