import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { expectFrameLoaded } from "./workspace_actions.js";

for (const delayedStyles of [false, true]) {
  test(`the served catalogue reaches component designs and follows their variant links${delayedStyles ? " with delayed styles" : ""}`, async ({
    page,
  }) => {
    await page.goto("/view/design/components/overview/");
    await expect(
      page.locator(
        'a[data-nav-row][data-route="design/components/overview/index.html"]',
      ),
    ).toHaveAttribute("aria-current", "page");
    const iframe = page.locator(".mbk-frame-desktop iframe");
    const desktop = iframe.contentFrame();
    await expectFrameLoaded(
      iframe,
      /\/static\/mokly-generated\/design\/components\/overview\/index\.desktop\.html$/,
    );
    await expect(
      desktop.locator(".mbk-component-canvas:visible"),
    ).toBeVisible();
    let delayedRequests = 0;
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    if (delayedStyles) {
      await page.route("**/*.css", async (route) => {
        delayedRequests++;
        await released;
        await route.continue();
      });
    }
    try {
      await desktop
        .getByRole("navigation", { name: "Saved variants" })
        .getByRole("link", { name: "Disabled", exact: true })
        .click();
      await expect(page).toHaveURL(
        /\/view\/design\/components\/pages\/variants\/$/,
      );
      await expect(
        page.locator(
          'a[data-nav-row][data-route="design/components/pages/variants/index.html"]',
        ),
      ).toHaveAttribute("aria-current", "page");
      if (delayedStyles) {
        await expect.poll(() => delayedRequests).toBeGreaterThan(0);
        release();
      }
      await expectFrameLoaded(
        iframe,
        /\/static\/mokly-generated\/design\/components\/pages\/variants\/index\.desktop\.html$/,
      );
      await expect(
        desktop.locator(".mbk-component-canvas:visible button"),
      ).toBeDisabled();
      await expect(
        desktop.locator(".mbk-component-canvas:visible"),
      ).toHaveCount(1);
      await expect(
        desktop.locator(".mbk-component-canvas.mbk-frame-desktop"),
      ).toBeVisible();
      if (delayedStyles) expect(delayedRequests).toBeGreaterThan(0);
    } finally {
      release();
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });
}
