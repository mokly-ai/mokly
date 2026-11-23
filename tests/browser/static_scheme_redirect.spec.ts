/**
 * Frame sources in published output on a host that normalizes HTML URLs,
 * under the static delivery and frame adapter contracts: each frame source
 * is redirected to its extensionless address. On the canvas each frame ends
 * ready on its own scheme's document while another one waits. Below the
 * layout breakpoint, while the desktop replacement of a scheme swap waits
 * before its redirect, the mobile frame ends ready on the new scheme; then
 * the desktop frame follows and ends ready.
 */

import { expect, type Page, type Route } from "@playwright/test";

import { normalizingHost } from "./normalizing_host.js";
import { copiedStaticUrl, test } from "./static_test.js";
import {
  canvasFrame,
  chooseScheme,
  chooseViewport,
  expectFrameLoaded,
  NARROW_WINDOW,
} from "./workspace_actions.js";

/** A frame of the one-frame stage below the layout breakpoint. */
const stageFrame = (viewport: "desktop" | "mobile") =>
  `.mbk-frame-${viewport} iframe`;

const WELCOME = "/static/mokly-generated/example/screens/welcome/";

/** The ready check of one frame on its document at the host's address. */
async function expectReady(page: Page, selector: string, file: string) {
  const frame = page.locator(selector);
  await expectFrameLoaded(
    frame,
    new RegExp(`${WELCOME}${file.replaceAll(".", "\\.")}$`, "u"),
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
      await expectReady(page, canvasFrame(viewport), `index.${viewport}`);
    await expectReady(page, canvasFrame("mobile", "dark"), "index.mobile.dark");
    await expect(page.locator(canvasFrame("desktop", "dark"))).toHaveAttribute(
      "data-mokly-frame-state",
      "loading",
    );
    await held[0]!.continue();
    await expectReady(
      page,
      canvasFrame("desktop", "dark"),
      "index.desktop.dark",
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

test("below the layout breakpoint, a published scheme swap ends ready when a redirect replaces each frame source", async ({
  page,
}) => {
  // The one-frame stage swaps each frame's document with the appearance.
  await page.setViewportSize(NARROW_WINDOW);
  const host = await normalizingHost(copiedStaticUrl());
  try {
    // Hold the desktop dark replacement before it reaches the host.
    const held: Route[] = [];
    await page.route(`**${WELCOME}index.desktop.dark.html`, (route) => {
      held.push(route);
    });
    await page.goto(`${host.url}/view/example/screens/welcome/`);
    await chooseViewport(page, "both");
    for (const viewport of ["mobile", "desktop"] as const)
      await expectReady(page, stageFrame(viewport), `index.${viewport}`);

    await chooseScheme(page, "dark");
    await expect.poll(() => held.length).toBe(1);
    // The mobile replacement completes while the desktop one waits.
    await expectReady(page, stageFrame("mobile"), "index.mobile.dark");
    await expect(page.locator(stageFrame("desktop"))).toHaveAttribute(
      "data-mokly-frame-state",
      "loading",
    );
    await held[0]!.continue();
    await expectReady(page, stageFrame("desktop"), "index.desktop.dark");
    for (const viewport of ["mobile", "desktop"] as const)
      await expect(
        page.frameLocator(stageFrame(viewport)).locator("html"),
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
