/**
 * Frame sources in published output on a host that normalizes HTML URLs,
 * under the static delivery and frame adapter contracts: each frame source
 * is redirected to its extensionless address. On the canvas each frame ends
 * ready on its own scheme's document while another one waits. Below the
 * layout breakpoint, while the desktop dark document waits before its
 * redirect, a scheme swap shows the Mobile · Dark frame ready on the new
 * scheme; the picked Desktop · Dark frame then follows and ends ready.
 */

import { expect, type Page, type Route } from "@playwright/test";

import { normalizingHost } from "./normalizing_host.js";
import { copiedStaticUrl, test } from "./static_test.js";
import {
  canvasFrame,
  chooseScheme,
  expectFrameLoaded,
  NARROW_WINDOW,
  viewportFrame,
} from "./workspace_actions.js";

const WELCOME = "/static/mokly-generated/example/screens/welcome/";

/** The ready check of one frame on a document at the host's address. */
async function expectReady(page: Page, selector: string, document: string) {
  const frame = page.locator(selector);
  await expectFrameLoaded(
    frame,
    new RegExp(`${document.replaceAll(".", "\\.")}$`, "u"),
  );
  await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
}

test("on the canvas, each frame ends ready on its own scheme's redirected source while another waits", async ({
  page,
}) => {
  const host = await normalizingHost(copiedStaticUrl());
  try {
    // Hold the desktop dark document before it reaches the host.
    const held: Route[] = [];
    await page.route(`**${WELCOME}index.desktop.dark.html`, (route) => {
      held.push(route);
    });
    await page.goto(`${host.url}/view/example/screens/welcome/`);
    await expect.poll(() => held.length).toBe(1);
    for (const viewport of ["mobile", "desktop"] as const)
      await expectReady(
        page,
        canvasFrame(viewport),
        `${WELCOME}index.${viewport}`,
      );
    await expectReady(
      page,
      canvasFrame("mobile", "dark"),
      `${WELCOME}index.mobile.dark`,
    );
    await expect(page.locator(canvasFrame("desktop", "dark"))).toHaveAttribute(
      "data-mokly-frame-state",
      "loading",
    );
    await held[0]!.continue();
    await expectReady(
      page,
      canvasFrame("desktop", "dark"),
      `${WELCOME}index.desktop.dark`,
    );
    for (const viewport of ["mobile", "desktop"] as const)
      await expect(
        page.frameLocator(canvasFrame(viewport, "dark")).locator("html"),
      ).toHaveCSS("color-scheme", "dark");
    expect(host.redirected).toEqual(
      expect.arrayContaining(
        ["mobile", "desktop"].map(
          (viewport) => `${WELCOME}index.${viewport}.dark.html`,
        ),
      ),
    );
  } finally {
    await page.goto("about:blank");
    await host.close();
  }
});

test("below the layout breakpoint, a published scheme swap ends ready on each frame whose redirected source waited", async ({
  page,
}) => {
  // The compact layout shows the frame of the chosen viewport and scheme,
  // and every frame stays mounted on its own scheme's document.
  await page.setViewportSize(NARROW_WINDOW);
  const host = await normalizingHost(copiedStaticUrl());
  try {
    // Hold the desktop dark document before it reaches the host.
    const held: Route[] = [];
    await page.route(`**${WELCOME}index.desktop.dark.html`, (route) => {
      held.push(route);
    });
    await page.goto(`${host.url}/view/example/screens/welcome/`);
    await expect.poll(() => held.length).toBe(1);
    await expectReady(page, viewportFrame("mobile"), `${WELCOME}index.mobile`);

    await chooseScheme(page, "dark");
    // The Mobile · Dark frame shows, ready, while the desktop one waits.
    await expect(page.locator(viewportFrame("mobile"))).toHaveAttribute(
      "data-workspace-color-scheme",
      "dark",
    );
    await expectReady(
      page,
      viewportFrame("mobile"),
      `${WELCOME}index.mobile.dark`,
    );
    await expect(page.locator(canvasFrame("desktop", "dark"))).toHaveAttribute(
      "data-mokly-frame-state",
      "loading",
    );
    // The picker shows the waiting Desktop · Dark frame, which then follows.
    await page
      .getByLabel("Frame", { exact: true })
      .selectOption({ label: "Desktop · Dark" });
    await expect(page.locator(viewportFrame("desktop"))).toHaveAttribute(
      "data-mokly-frame-state",
      "loading",
    );
    await held[0]!.continue();
    await expectReady(
      page,
      viewportFrame("desktop"),
      `${WELCOME}index.desktop.dark`,
    );
    for (const viewport of ["mobile", "desktop"] as const)
      await expect(
        page.frameLocator(canvasFrame(viewport, "dark")).locator("html"),
      ).toHaveCSS("color-scheme", "dark");
    expect(host.redirected).toEqual(
      expect.arrayContaining(
        ["mobile", "desktop"].map(
          (viewport) => `${WELCOME}index.${viewport}.dark.html`,
        ),
      ),
    );
  } finally {
    await page.goto("about:blank");
    await host.close();
  }
});
