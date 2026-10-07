import { setTimeout } from "node:timers/promises";

import { expect, test } from "@playwright/test";

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
    await expect(desktop.locator(".ce-canvas:visible")).toBeVisible();
    let delayedRequests = 0;
    if (delayedStyles) {
      await page.route(
        "**/static/design-component-workspace.css",
        async (route) => {
          delayedRequests++;
          await setTimeout(500);
          await route.continue();
        },
      );
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
      await expectFrameLoaded(
        iframe,
        /\/static\/mokly-generated\/design\/components\/pages\/variants\/index\.desktop\.html$/,
      );
      await expect(desktop.locator(".ce-canvas:visible button")).toBeDisabled();
      await expect(desktop.locator(".ce-canvas:visible")).toHaveCount(1);
      await expect(
        desktop.getByRole("region", {
          name: "Desktop component preview",
          exact: true,
        }),
      ).toBeVisible();
      if (delayedStyles) expect(delayedRequests).toBeGreaterThan(0);
    } finally {
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });
}
