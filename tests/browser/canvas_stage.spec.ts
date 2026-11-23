import { expect, type Locator, type Page } from "@playwright/test";

import { test } from "./browser_test.js";

/** The room that the zoom pill keeps at the canvas's bottom edge. */
const PILL_ROOM = 48;

const WELCOME = "/view/example/screens/welcome/";
const GUIDE = "/view/example/workspace-guide/";

function canvas(page: Page): Locator {
  return page.locator("[data-mokly-stage]");
}

function section(page: Page): Locator {
  return canvas(page).locator(".mbk-canvas-section");
}

function frame(page: Page, viewport: string, scheme: string): Locator {
  return page.locator(
    `iframe[data-workspace-frame="${viewport}"][data-workspace-color-scheme="${scheme}"]`,
  );
}

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

/**
 * The stage: the canvas between the floating panels and above the zoom pill,
 * which the canvas's invisible stage box covers.
 */
function stageArea(page: Page) {
  return canvas(page)
    .locator(".mbk-canvas-stage")
    .evaluate((element) => {
      const { height, width, x, y } = element.getBoundingClientRect();
      return { height, width, x, y };
    });
}

/** The zoom that a frame of a nominal width shows: its width on screen. */
async function zoomOf(locator: Locator, nominal: number): Promise<number> {
  return (await box(locator)).width / nominal;
}

/** The canvas places the section on whole pixels, so lengths agree to 1px. */
function near(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
}

async function openWelcome(page: Page): Promise<Locator> {
  await page.goto(WELCOME);
  await expect(page.locator("iframe[data-workspace-frame]")).toHaveCount(4);
  await expect(page.getByRole("group", { name: "Zoom" })).toBeVisible();
  return frame(page, "desktop", "light");
}

test("an entry opens fitted: the section stands centred on the stage, below 100%", async ({
  page,
}) => {
  const desktop = await openWelcome(page);
  const area = await box(canvas(page));
  // The stage keeps the zoom pill's room at the canvas's bottom edge.
  const stage = await stageArea(page);
  near(area.y + area.height - (stage.y + stage.height), PILL_ROOM);
  const placed = await box(section(page));
  const room = { bottom: stage.y + stage.height };
  expect(placed.x).toBeGreaterThanOrEqual(stage.x);
  expect(placed.x + placed.width).toBeLessThanOrEqual(stage.x + stage.width);
  expect(placed.y).toBeGreaterThanOrEqual(stage.y);
  expect(placed.y + placed.height).toBeLessThanOrEqual(room.bottom);
  // Centred on both axes, with Fit's margin on the axis that limits it.
  near(placed.x - stage.x, stage.x + stage.width - placed.x - placed.width);
  near(placed.y - stage.y, room.bottom - placed.y - placed.height);
  const zoom = await zoomOf(desktop, 1280);
  expect(zoom).toBeLessThan(1);
  await expect(page.getByRole("group", { name: "Zoom" })).toContainText(
    `${Math.round(zoom * 100)}%`,
  );
  // Every frame's label stands on the canvas too.
  for (const label of await canvas(page).locator("figcaption").all()) {
    const bounds = await box(label);
    expect(bounds.y).toBeGreaterThanOrEqual(stage.y);
  }
});

test("the zoom pill steps the zoom by 1.25 and 0.8, and Fit refits", async ({
  page,
}) => {
  const desktop = await openWelcome(page);
  const pill = page.getByRole("group", { name: "Zoom" });
  const fitted = await zoomOf(desktop, 1280);
  await pill.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => zoomOf(desktop, 1280)).toBeCloseTo(fitted * 1.25, 2);
  await pill.getByRole("button", { name: "Zoom out" }).click();
  await pill.getByRole("button", { name: "Zoom out" }).click();
  await expect.poll(() => zoomOf(desktop, 1280)).toBeCloseTo(fitted * 0.8, 2);
  await pill.getByRole("button", { name: "Fit" }).click();
  await expect.poll(() => zoomOf(desktop, 1280)).toBeCloseTo(fitted, 2);
});

test("the keys zoom, show 100% and fit, but not in a text field or with Alt", async ({
  page,
}) => {
  const desktop = await openWelcome(page);
  const fitted = await zoomOf(desktop, 1280);
  await page.keyboard.press("Equal");
  await expect.poll(() => zoomOf(desktop, 1280)).toBeCloseTo(fitted * 1.25, 2);
  await page.keyboard.press("Minus");
  await expect.poll(() => zoomOf(desktop, 1280)).toBeCloseTo(fitted, 2);
  await page.keyboard.press("Shift+Digit0");
  await expect.poll(() => zoomOf(desktop, 1280)).toBeCloseTo(1, 2);
  await page.keyboard.press("Shift+Digit1");
  await expect.poll(() => zoomOf(desktop, 1280)).toBeCloseTo(fitted, 2);
  await page.keyboard.press("Alt+Equal");
  const search = page.getByRole("searchbox", { name: "Search catalogue" });
  await search.focus();
  await page.keyboard.press("Minus");
  await expect(search).toHaveValue("-");
  await search.fill("");
  expect(await zoomOf(desktop, 1280)).toBeCloseTo(fitted, 2);
});

test("the wheel pans the canvas around the frames and scrolls a frame's own document", async ({
  page,
}) => {
  await page.goto(GUIDE);
  const reading = page.locator("[data-mokly-stage] iframe");
  await expect(reading).toHaveAttribute("data-mokly-frame-state", "ready");
  const stage = await stageArea(page);
  const start = await box(section(page));
  await page.mouse.move(stage.x + 8, stage.y + stage.height / 2);
  await page.mouse.wheel(0, 120);
  await expect
    .poll(async () => Math.round((await box(section(page))).y - start.y))
    .toBe(-120);
  const panned = await box(section(page));
  const document = await box(reading);
  await page.mouse.move(
    document.x + document.width / 2,
    document.y + document.height / 2,
  );
  await page.mouse.wheel(0, 400);
  await expect
    .poll(() =>
      reading.evaluate(
        (element: HTMLIFrameElement) => element.contentWindow?.scrollY ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  expect(await box(section(page))).toEqual(panned);
});

test("⌘ or Ctrl with the wheel zooms about the pointer", async ({ page }) => {
  const desktop = await openWelcome(page);
  const mobile = frame(page, "mobile", "light");
  const before = { desktop: await box(desktop), mobile: await box(mobile) };
  // The pointer stands in the gap between Desktop · Light and Mobile · Light,
  // on whole pixels, as mouse events report it.
  const pointer = {
    x: Math.round(
      (before.desktop.x + before.desktop.width + before.mobile.x) / 2,
    ),
    y: Math.round(before.desktop.y + 40),
  };
  const down = pointer.y - before.desktop.y;
  await page.mouse.move(pointer.x, pointer.y);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -100);
  await page.keyboard.up("Control");
  const factor = Math.exp(0.8);
  await expect
    .poll(async () => (await box(desktop)).width)
    .toBeCloseTo(before.desktop.width * factor, 0);
  const after = { desktop: await box(desktop), mobile: await box(mobile) };
  // The gap keeps its length, so Mobile keeps its distance from the pointer,
  // and the distance down to the pointer in Desktop grows with the zoom.
  near(after.mobile.x - pointer.x, before.mobile.x - pointer.x);
  near(pointer.y - after.desktop.y, down * factor);
});

test("a resize refits a fitted stage, and keeps the view after a pan", async ({
  page,
}) => {
  const desktop = await openWelcome(page);
  const fitted = await zoomOf(desktop, 1280);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(() => zoomOf(desktop, 1280)).toBeGreaterThan(fitted + 0.02);
  const grown = await zoomOf(desktop, 1280);
  const area = await box(canvas(page));
  const stage = await stageArea(page);
  const start = await box(section(page));
  await page.mouse.move(stage.x + 8, stage.y + 8);
  await page.mouse.wheel(-40, 0);
  await expect
    .poll(async () => Math.round((await box(section(page))).x - start.x))
    .toBe(40);
  const offset = (await box(section(page))).x - area.x;
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect
    .poll(async () => (await box(canvas(page))).height)
    .toBeLessThan(area.height);
  expect(await zoomOf(desktop, 1280)).toBeCloseTo(grown, 3);
  near((await box(section(page))).x - (await box(canvas(page))).x, offset);
});

test("the highlight masks follow the frames when the canvas pans", async ({
  page,
}) => {
  await openWelcome(page);
  await expect(
    page.locator(
      'iframe[data-workspace-frame][data-mokly-frame-state="ready"]',
    ),
  ).toHaveCount(4);
  await page
    .getByRole("button", { name: "Highlight components", exact: true })
    .click();
  const layer = page.locator(".mbk-highlight-layer").first();
  await expect(layer).toBeVisible();
  const before = await box(layer);
  const stage = await stageArea(page);
  await page.mouse.move(stage.x + 8, stage.y + 8);
  await page.mouse.wheel(-60, 0);
  await expect
    .poll(async () => Math.round((await box(layer)).x - before.x))
    .toBe(60);
  near((await box(layer)).y, before.y);
});

test("a variant set opens fitted to its components' measured frames at a readable zoom", async ({
  page,
}) => {
  // The inspector still stands below the canvas, so the window gives the
  // stage the height that four rows need beside their fixed labels and gaps.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/view/example/components/action/");
  // Four rows, the action's own example and its three saved variants, each
  // Light beside Dark.
  const frames = canvas(page).locator(
    '.mbk-canvas-frame[data-canvas-frame="component"]',
  );
  await expect(frames).toHaveCount(8);
  await expect(
    frames.locator('iframe[data-mokly-frame-state="ready"]'),
  ).toHaveCount(8);
  // Each frame takes the size that the action's content needs, far below a
  // desktop frame's 1280 × 800.
  const nominal = () =>
    frames.evaluateAll((elements) =>
      elements.map((element) => {
        const style = (element as HTMLElement).style;
        return {
          height: Number(style.getPropertyValue("--mbk-canvas-frame-height")),
          width: Number(style.getPropertyValue("--mbk-canvas-frame-width")),
        };
      }),
    );
  await expect
    .poll(async () =>
      (await nominal()).every(
        ({ height, width }) =>
          width > 0 && width < 400 && height > 0 && height < 200,
      ),
    )
    .toBe(true);
  // The canvas refits to the measured frames: the zoom that the pill names
  // shows them readably, and Fit keeps it. The frame's box, not its
  // document's, which rounds the size up, gives the zoom.
  const pill = page.getByRole("group", { name: "Zoom" });
  const { width } = (await nominal())[0]!;
  const zoom = () => zoomOf(frames.first(), width);
  await expect.poll(zoom).toBeGreaterThanOrEqual(0.5);
  const fitted = await zoom();
  await expect(pill).toContainText(`${Math.round(fitted * 100)}%`);
  await pill.getByRole("button", { name: "Fit" }).click();
  expect(await zoom()).toBeCloseTo(fitted, 3);
  // The fitted section stands on the stage, clear of the pill's room.
  const stage = await box(canvas(page));
  const placed = await box(section(page));
  expect(placed.y).toBeGreaterThanOrEqual(stage.y);
  expect(placed.y + placed.height).toBeLessThanOrEqual(
    stage.y + stage.height - PILL_ROOM,
  );
});
