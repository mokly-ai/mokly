import { expect, type Locator, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import { tabTo } from "./tab_to.js";

/** The focus glow's ring: a 4px spread without blur, before any other shadow. */
const GLOW = /^(?:rgba?|color)\([^)]*\) 0px 0px 0px 4px(?:,|$)/u;

const WELCOME = "/view/example/screens/welcome/";

async function shadow(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).boxShadow);
}

/** The canvas section's path chip, beside the head band's own chip. */
function pathChip(page: Page): Locator {
  return page.locator("[data-mokly-stage]").getByRole("button", {
    name: "Copy path example/screens/welcome",
    exact: true,
  });
}

/** The Welcome screen's Light frame of a viewport on the canvas. */
function lightFrame(page: Page, viewport: "desktop" | "mobile") {
  const iframe = page.locator(
    `iframe[data-workspace-frame="${viewport}"][data-workspace-color-scheme="light"]`,
  );
  const frame = page.locator(".mbk-canvas-frame").filter({ has: iframe });
  return { box: frame.locator(".mbk-canvas-frame-clip"), iframe };
}

/** Let the frames' documents report their focus: three animation frames. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let frames = 0;
        const step = () =>
          ++frames >= 3 ? resolve() : requestAnimationFrame(step);
        requestAnimationFrame(step);
      }),
  );
}

test("the zoom pill's buttons and the path chip draw the focus glow", async ({
  page,
}) => {
  await page.goto(WELCOME);
  const pill = page.getByRole("group", { name: "Zoom" });
  const controls = [
    pathChip(page),
    pill.getByRole("button", { name: "Zoom out", exact: true }),
    pill.getByRole("button", { name: "Zoom in", exact: true }),
    pill.getByRole("button", { name: "Fit", exact: true }),
  ];
  for (const control of controls) {
    await expect(control).toBeVisible();
    expect(await shadow(control)).not.toMatch(GLOW);
    await tabTo(page, control);
    await expect(control).toBeFocused();
    expect(await shadow(control)).toMatch(GLOW);
  }
});

test("Tab into a frame draws the glow on that frame's box, and a click into a frame does not", async ({
  page,
}) => {
  await page.goto(WELCOME);
  const desktop = lightFrame(page, "desktop");
  const mobile = lightFrame(page, "mobile");
  await expect(desktop.iframe).toHaveAttribute(
    "data-mokly-frame-state",
    "ready",
  );
  await expect(mobile.iframe).toHaveAttribute(
    "data-mokly-frame-state",
    "ready",
  );
  expect(await shadow(desktop.box)).not.toMatch(GLOW);
  // The path chip stands just before the frames, so the next Tab moves into
  // the first frame's document.
  await tabTo(page, pathChip(page));
  await page.keyboard.press("Tab");
  await expect(desktop.iframe).toBeFocused();
  await expect.poll(() => shadow(desktop.box)).toMatch(GLOW);
  expect(await shadow(mobile.box)).not.toMatch(GLOW);
  // Focus that leaves the frame takes the glow with it.
  await page.keyboard.press("Shift+Tab");
  await expect(pathChip(page)).toBeFocused();
  await expect.poll(() => shadow(desktop.box)).not.toMatch(GLOW);
  // A click on an empty place of another frame's document gives it focus
  // without the glow.
  await mobile.iframe
    .contentFrame()
    .locator("html")
    .click({ position: { x: 4, y: 4 } });
  await expect(mobile.iframe).toBeFocused();
  await settle(page);
  expect(await shadow(mobile.box)).not.toMatch(GLOW);
  // Tab from there moves keyboard focus inside that document: its glow shows.
  await page.keyboard.press("Tab");
  await expect.poll(() => shadow(mobile.box)).toMatch(GLOW);
  expect(await shadow(desktop.box)).not.toMatch(GLOW);
});
