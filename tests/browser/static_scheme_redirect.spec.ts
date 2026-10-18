/**
 * A scheme swap in published output on a host that normalizes HTML URLs,
 * under the static delivery and frame adapter contracts: each frame source
 * that the swap replaces is redirected to its extensionless address, and
 * every frame follows it and ends ready on the new scheme.
 */

import { expect } from "@playwright/test";

import { normalizingHost } from "./normalizing_host.js";
import { copiedStaticUrl, test } from "./static_test.js";
import {
  chooseScheme,
  chooseViewport,
  expectFrameLoaded,
} from "./workspace_actions.js";

const WELCOME = "/static/mokly-generated/example/screens/welcome/";

test("a published scheme swap ends ready when a redirect replaces each frame source", async ({
  page,
}) => {
  const host = await normalizingHost(copiedStaticUrl());
  try {
    await page.goto(`${host.url}/view/example/screens/welcome/`);
    await chooseViewport(page, "both");
    for (const viewport of ["mobile", "desktop"] as const) {
      const frame = page.locator(`.mbk-frame-${viewport} iframe`);
      await expectFrameLoaded(
        frame,
        new RegExp(`${WELCOME}index\\.${viewport}$`, "u"),
      );
      await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
    }

    await chooseScheme(page, "dark");
    for (const viewport of ["mobile", "desktop"] as const) {
      const frame = page.locator(`.mbk-frame-${viewport} iframe`);
      await expectFrameLoaded(
        frame,
        new RegExp(`${WELCOME}index\\.${viewport}\\.dark$`, "u"),
      );
      await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
      await expect(
        page.frameLocator(`.mbk-frame-${viewport} iframe`).locator("html"),
      ).toHaveCSS("color-scheme", "dark");
    }
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
