import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { canvasFrame, expectFrameLoaded } from "./workspace_actions.js";

/** The served document of a Canvas design route in the desktop frame. */
function desktopDocument(route: string): RegExp {
  const escaped = route.replaceAll("/", "\\/");
  return new RegExp(
    `\\/static\\/mokly-generated\\/${escaped}\\/index\\.desktop\\.html$`,
    "u",
  );
}

// A frame link must still open its destination while that document's
// stylesheets are delayed: the regression of pull request 57.
test("the served catalogue follows a component design's variant link with delayed styles", async ({
  page,
}) => {
  // The viewer's desktop frame lays the artboard out at the frame's own
  // width. Below 900px a Canvas root takes its compact form, which closes the
  // panel that holds the Variants links, so the page gives it the full layout.
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto("/view/design/canvas/stage/component-set/");
  await expect(
    page.locator(
      'a[data-nav-row][data-route="design/canvas/stage/component-set/index.html"]',
    ),
  ).toHaveAttribute("aria-current", "page");
  // The design screen's Desktop · Light frame on the canvas.
  const iframe = page.locator(canvasFrame("desktop"));
  const desktop = iframe.contentFrame();
  await expectFrameLoaded(
    iframe,
    desktopDocument("design/canvas/stage/component-set"),
  );
  await expect(
    desktop.locator('.cv-frame[data-cv-frame="disabled-light"]'),
  ).toBeVisible();
  let delayedRequests = 0;
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*.css", async (route) => {
    delayedRequests++;
    await released;
    await route.continue();
  });
  try {
    await desktop
      .getByRole("region", { name: "Variants", exact: true })
      .getByRole("link", { name: "Disabled", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/view\/design\/canvas\/stage\/component-set\/disabled\/$/u,
    );
    await expect(
      page.locator(
        'a[data-nav-row][data-route="design/canvas/stage/component-set/disabled/index.html"]',
      ),
    ).toHaveAttribute("aria-current", "page");
    await expect.poll(() => delayedRequests).toBeGreaterThan(0);
    release();
    await expectFrameLoaded(
      iframe,
      desktopDocument("design/canvas/stage/component-set/disabled"),
    );
    // The variant's own artboard: its frame is chosen, and Props edits it.
    await expect(
      desktop.locator('.cv-frame[data-cv-frame="disabled-light"]'),
    ).toHaveAttribute("data-cv-selected", "");
    await expect(
      desktop
        .locator('[data-cv-section="props"]')
        .getByRole("checkbox", { name: "Disabled", exact: true }),
    ).toBeChecked();
    expect(delayedRequests).toBeGreaterThan(0);
  } finally {
    release();
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});
