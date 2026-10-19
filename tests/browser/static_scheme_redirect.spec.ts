/**
 * A scheme swap in published output on a host that normalizes HTML URLs,
 * under the static delivery and frame adapter contracts: each frame source
 * that the swap replaces is redirected to its extensionless address. While
 * the desktop replacement waits before its redirect, the mobile frame ends
 * ready on the new scheme; then the desktop frame follows and ends ready.
 */

import { expect, type Page, type Route } from "@playwright/test";

import { normalizingHost } from "./normalizing_host.js";
import { copiedStaticUrl, test } from "./static_test.js";
import {
  chooseScheme,
  chooseViewport,
  expectFrameLoaded,
} from "./workspace_actions.js";

const WELCOME = "/static/mokly-generated/example/screens/welcome/";

/** The ready check of one frame on its document at the host's address. */
async function expectReady(
  page: Page,
  viewport: "mobile" | "desktop",
  file: string,
) {
  const frame = page.locator(`.mbk-frame-${viewport} iframe`);
  await expectFrameLoaded(
    frame,
    new RegExp(`${WELCOME}${file.replaceAll(".", "\\.")}$`, "u"),
  );
  await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
}

test("a published scheme swap ends ready when a redirect replaces each frame source", async ({
  page,
}) => {
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
      await expectReady(page, viewport, `index.${viewport}`);

    await chooseScheme(page, "dark");
    await expect.poll(() => held.length).toBe(1);
    // The mobile replacement completes while the desktop one waits.
    await expectReady(page, "mobile", "index.mobile.dark");
    await expect(page.locator(".mbk-frame-desktop iframe")).toHaveAttribute(
      "data-mokly-frame-state",
      "loading",
    );
    await held[0]!.continue();
    await expectReady(page, "desktop", "index.desktop.dark");
    for (const viewport of ["mobile", "desktop"] as const)
      await expect(
        page.frameLocator(`.mbk-frame-${viewport} iframe`).locator("html"),
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
