/**
 * The appearance hands a Markdown document's reading frame the render of the
 * chosen scheme, in the compact layout below the layout breakpoint and on
 * the canvas: the frame keeps its element and its adapter navigates it. A
 * superseded Dark response cannot replace the newer Light selection, and
 * Light replaces a Dark document before its resources finish loading. A
 * screen's frames keep their own scheme, so none of them swaps.
 */

import { expect } from "@playwright/test";

import { shellRoot } from "./browse_assertions.js";
import { test } from "./browser_test.js";
import {
  chooseScheme,
  DOCUMENT_FRAME,
  expectFrameLoaded,
  NARROW_WINDOW,
} from "./workspace_actions.js";

const GUIDE = "example/workspace-guide";

/** The address of the guide's render of one scheme. */
function render(scheme: "dark" | "light"): string {
  return `/static/mokly-generated/${GUIDE}/index${scheme === "dark" ? ".dark" : ""}.html`;
}

/** The guide's light render, as the frame's loaded address ends. */
const LIGHT = new RegExp(`${render("light").replaceAll(".", "\\.")}$`, "u");

for (const [layout, viewport] of [
  ["below the layout breakpoint", NARROW_WINDOW],
  ["on the canvas", { width: 1280, height: 900 }],
] as const)
  test.describe(layout, () => {
    test.use({ viewport });

    test("a superseded Dark response cannot replace the newer Light selection", async ({
      page,
    }) => {
      await page.goto(`/view/${GUIDE}/`);
      await expect(page.locator("[data-mokly-search]")).toBeVisible();
      const frame = page.locator(DOCUMENT_FRAME);
      await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
      let release = () => {};
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      const dark = `**${render("dark")}`;
      await page.route(dark, async (route) => {
        await released;
        await route.continue();
      });

      try {
        const requested = page.waitForRequest(dark);
        await chooseScheme(page, "dark");
        const request = await requested;
        const finished = Promise.race([
          page.waitForEvent(
            "requestfinished",
            (candidate) => candidate === request,
          ),
          page.waitForEvent(
            "requestfailed",
            (candidate) => candidate === request,
          ),
        ]);
        await chooseScheme(page, "light");
        await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
        release();
        await finished;
        await expectFrameLoaded(frame, LIGHT);
      } finally {
        release();
      }
    });

    test("Light replaces a Dark document before its resources finish loading", async ({
      page,
    }) => {
      await page.goto(`/view/${GUIDE}/`);
      await expect(page.locator("[data-mokly-search]")).toBeVisible();
      const frame = page.locator(DOCUMENT_FRAME);
      await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");

      let release = () => {};
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/held-preview.css", async (route) => {
        await released;
        await route.fulfill({ body: "", contentType: "text/css" });
      });
      await page.route(`**${render("dark")}`, async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          body: (await response.text()).replace(
            "</head>",
            '<link rel="stylesheet" href="/held-preview.css"></head>',
          ),
        });
      });

      try {
        await chooseScheme(page, "dark");
        await expect
          .poll(() =>
            frame.evaluate((element: HTMLIFrameElement) => ({
              path: element.contentWindow?.location.pathname,
              readyState: element.contentDocument?.readyState,
            })),
          )
          .toEqual({ path: render("dark"), readyState: "interactive" });

        await chooseScheme(page, "light");
        await expectFrameLoaded(frame, LIGHT);
        await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
        await expect(page.locator(shellRoot)).toHaveAttribute(
          "data-mokly-color-scheme",
          "light",
        );
      } finally {
        release();
      }
    });
  });
