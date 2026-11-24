/**
 * The client-rendered shell over Serve of the example, under the shell
 * delivery contract, in each layout of the canvas: Back and Forward open
 * each route fitted, on the canvas and in the compact layout, and below the
 * layout breakpoint the shown frame follows a chosen scheme whose document
 * is still pending.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import {
  CANVAS_FRAMES,
  holdReads,
  MEMBERS,
  navLink,
  openFolder,
  route,
  WELCOME,
} from "./shell_route_fixture.js";
import {
  canvasFrame,
  chooseScheme,
  expectFrameLoaded,
  NARROW_WINDOW,
  openCatalogueSheet,
  viewportFrame,
} from "./workspace_actions.js";

/** The zoom that the canvas's pill shows, such as `42%`. */
async function shownZoom(page: Page): Promise<string> {
  const text = await page.getByRole("group", { name: "Zoom" }).textContent();
  const zoom = /\d+%/u.exec(text ?? "")?.[0];
  expect(zoom).toBeDefined();
  return zoom!;
}

/** A frame's place on the page, in whole pixels. */
async function place(frame: Locator) {
  const box = await frame.boundingBox();
  expect(box).not.toBeNull();
  const { height, width, x, y } = box!;
  return [x, y, width, height].map(Math.round);
}

/** Pan the canvas with the wheel over its stage, beside the frames. */
async function panCanvas(page: Page, deltaY: number): Promise<void> {
  const stage = await page
    .locator("[data-mokly-stage] .mbk-canvas-stage")
    .evaluate((element) => {
      const { x, y } = element.getBoundingClientRect();
      return { x, y };
    });
  await page.mouse.move(stage.x + 8, stage.y + 8);
  await page.mouse.wheel(0, deltaY);
}

test.describe("with a clean console", () => {
  test("on the canvas, Back and Forward open each route fitted", async ({
    page,
  }) => {
    await page.goto(route(WELCOME));
    await expect(page.locator("#mb-main iframe")).toHaveCount(CANVAS_FRAMES);
    const pill = page.getByRole("group", { name: "Zoom" });
    const welcome = await shownZoom(page);
    await pill.getByRole("button", { name: "Zoom in" }).click();
    await expect(pill).not.toContainText(welcome);
    await openFolder(page, "example/team");
    await navLink(page, MEMBERS).click();
    await expect(page).toHaveURL(new RegExp(`${route(MEMBERS)}$`));
    await expect(page.locator("#mb-main iframe")).toHaveCount(CANVAS_FRAMES);
    const members = await shownZoom(page);
    await pill.getByRole("button", { name: "Fit" }).click();
    await expect(pill).toContainText(members);
    await pill.getByRole("button", { name: "Zoom in" }).click();
    await expect(pill).not.toContainText(members);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${route(WELCOME)}$`));
    await expect(pill).toContainText(welcome);
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`${route(MEMBERS)}$`));
    await expect(pill).toContainText(members);
  });

  test("below the layout breakpoint, Back and Forward open each route fitted", async ({
    page,
  }) => {
    // The compact layout's canvas pans instead of scrolling, and each route
    // opens with its one frame fitted, as on the canvas.
    await page.setViewportSize({ width: NARROW_WINDOW.width, height: 520 });
    const mobile = (path: string) =>
      new RegExp(`/${path}/index\\.mobile\\.html$`, "u");
    await page.goto(route(WELCOME));
    const frame = page.locator(viewportFrame("mobile"));
    await expectFrameLoaded(frame, mobile(WELCOME));
    const welcome = await place(frame);
    await panCanvas(page, 120);
    await expect
      .poll(async () => (await place(frame))[1]! - welcome[1]!)
      .toBe(-120);
    // The catalogue is a sheet below the layout breakpoint.
    await openCatalogueSheet(page);
    await openFolder(page, "example/team");
    await navLink(page, MEMBERS).click();
    await expect(page).toHaveURL(new RegExp(`${route(MEMBERS)}$`));
    await expectFrameLoaded(frame, mobile(MEMBERS));
    const members = await place(frame);
    await panCanvas(page, 80);
    await expect
      .poll(async () => (await place(frame))[1]! - members[1]!)
      .toBe(-80);
    // Each route's frame stands where Fit placed it, not where it was panned.
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${route(WELCOME)}$`));
    await expectFrameLoaded(frame, mobile(WELCOME));
    await expect.poll(() => place(frame)).toEqual(welcome);
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`${route(MEMBERS)}$`));
    await expectFrameLoaded(frame, mobile(MEMBERS));
    await expect.poll(() => place(frame)).toEqual(members);
  });

  test("below the layout breakpoint, a scheme change while that scheme's frame document is pending ends with the shown frame on that scheme", async ({
    page,
  }) => {
    // The compact layout shows the frame of the chosen scheme, and each
    // mounted frame keeps its own scheme's document.
    await page.setViewportSize(NARROW_WINDOW);
    const document = (viewport: string, scheme: string) =>
      new RegExp(
        `/${WELCOME}/index\\.${viewport}${scheme === "dark" ? "\\.dark" : ""}\\.html$`,
      );
    const release = await holdReads(page, `/${WELCOME}/index.mobile.dark.html`);
    await page.goto(route(WELCOME));
    const shown = page.locator(viewportFrame("mobile"));
    await expectFrameLoaded(shown, document("mobile", "light"));
    await chooseScheme(page, "dark");
    await expect(shown).toHaveAttribute("data-workspace-color-scheme", "dark");
    await expect(shown).toHaveAttribute("data-mokly-frame-state", "loading");
    release();
    await expectFrameLoaded(shown, document("mobile", "dark"));
    await expect(shown).toHaveAttribute("data-mokly-frame-state", "ready");
    for (const viewport of ["mobile", "desktop"] as const)
      for (const scheme of ["light", "dark"] as const)
        await expectFrameLoaded(
          page.locator(canvasFrame(viewport, scheme)),
          document(viewport, scheme),
        );
    await page.unrouteAll({ behavior: "wait" });
  });
});
