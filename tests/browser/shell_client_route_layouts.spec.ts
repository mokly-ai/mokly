/**
 * The client-rendered shell over Serve of the example, under the shell
 * delivery contract, in each layout of the stage: on the canvas, Back and
 * Forward open each route fitted; below the layout breakpoint, the one-frame
 * stage restores each route's scroll and swaps every frame to a chosen
 * scheme.
 */

import { expect, type Page } from "@playwright/test";

import { historyScrolls } from "../../packages/viewer/src/shell/store_scroll.js";

import { desktopFrame, mobileFrame } from "./browse_assertions.js";
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
  chooseScheme,
  expectFrameLoaded,
  NARROW_WINDOW,
} from "./workspace_actions.js";

/** The zoom that the canvas's pill shows, such as `42%`. */
async function shownZoom(page: Page): Promise<string> {
  const text = await page.getByRole("group", { name: "Zoom" }).textContent();
  const zoom = /\d+%/u.exec(text ?? "")?.[0];
  expect(zoom).toBeDefined();
  return zoom!;
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

  test("below the layout breakpoint, Back and Forward restore each route's stage scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: NARROW_WINDOW.width, height: 520 });
    await page.goto(route(WELCOME));
    const stage = page.locator('[data-mokly-scroll="stage"]');
    await expect(page.locator("#mb-main iframe")).toHaveCount(2);
    await expect
      .poll(() =>
        stage.evaluate((element) => {
          element.scrollTop = 160;
          return element.scrollTop;
        }),
      )
      .toBe(160);
    await expect
      .poll(
        async () =>
          historyScrolls(await page.evaluate(() => history.state))["stage"],
      )
      .toBe(160);
    // The catalogue is a drawer below the layout breakpoint.
    await page.locator("[data-mokly-menu]").click();
    await openFolder(page, "example/team");
    await navLink(page, MEMBERS).click();
    await expect(page).toHaveURL(new RegExp(`${route(MEMBERS)}$`));
    await expect
      .poll(() => stage.evaluate((element) => element.scrollTop))
      .toBe(0);
    await expect(page.locator("#mb-main iframe")).toHaveCount(2);
    await expect
      .poll(() =>
        stage.evaluate((element) => {
          element.scrollTop = 120;
          return element.scrollTop;
        }),
      )
      .toBe(120);
    // The scroll offset changes before the scroll event saves it in history.
    await expect
      .poll(
        async () =>
          historyScrolls(await page.evaluate(() => history.state))["stage"],
      )
      .toBe(120);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${route(WELCOME)}$`));
    await expect
      .poll(() => stage.evaluate((element) => element.scrollTop))
      .toBe(160);
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`${route(MEMBERS)}$`));
    await expect
      .poll(() => stage.evaluate((element) => element.scrollTop))
      .toBe(120);
  });

  test("below the layout breakpoint, a scheme change while one frame document is pending ends with every frame on that scheme", async ({
    page,
  }) => {
    // The one-frame stage swaps each frame to the chosen scheme; on the
    // canvas each frame keeps its own.
    await page.setViewportSize(NARROW_WINDOW);
    const darkDocument = (viewport: string) =>
      new RegExp(`/${WELCOME}/index\\.${viewport}\\.dark\\.html$`);
    await page.goto(route(WELCOME));
    await expect(page.locator("#mb-main iframe")).toHaveCount(2);
    const release = await holdReads(
      page,
      `/${WELCOME}/index.desktop.dark.html`,
    );
    await chooseScheme(page, "dark");
    await expectFrameLoaded(page.locator(mobileFrame), darkDocument("mobile"));
    release();
    await expectFrameLoaded(
      page.locator(desktopFrame),
      darkDocument("desktop"),
    );
    await expectFrameLoaded(page.locator(mobileFrame), darkDocument("mobile"));
    await page.unrouteAll({ behavior: "wait" });
  });
});
