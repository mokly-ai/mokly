/**
 * The example's React components in the shell on the example Serve host,
 * under the component explorer and controls contracts: live edits through
 * the sidecar with their Usage consumers, each view's actual render context,
 * and Inspect's folded sections.
 */

import { expect, type FrameLocator, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import { showProps } from "./live_props.js";
import {
  canvasFrame,
  chooseScheme,
  NARROW_WINDOW,
  openInspectFold,
} from "./workspace_actions.js";

const ACTION = "/view/example/components/action/";

test("desktop: the example's React action renders live edits and lists its Usage consumers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${ACTION}?viewport=desktop`);
  // Props edits the row of the selected frame, the component's own one.
  const props = await showProps(page);
  // A row of the variant set shows the edit in its Light and Dark frames on
  // the canvas.
  const rowFrame = (row: string, scheme: "dark" | "light" = "light") =>
    page.frameLocator(
      `${canvasFrame("desktop", scheme)}[data-workspace-variant="${row}"]`,
    );
  const frame = rowFrame("example/components/action");
  const label = props.getByLabel("Label", { exact: true });
  await expect(label).toBeEditable();
  await label.fill("Ready to continue");
  const ready = (shown: FrameLocator) =>
    shown.getByRole("button", { name: "Ready to continue", exact: true });
  await expect(ready(frame)).toBeVisible();
  // The optional radius is set in the saved props, so its field shows.
  await props.locator('[data-prop-control="radius"]').fill("24");
  await expect(ready(frame)).toHaveCSS("border-radius", "24px");
  // A scheme change keeps the edit, and the dark view renders it.
  await chooseScheme(page, "dark");
  const dark = rowFrame("example/components/action", "dark");
  await expect(dark.locator("html")).toHaveCSS("color-scheme", "dark");
  await expect(ready(dark)).toHaveCSS("border-radius", "24px");
  await expect(label).toHaveValue("Ready to continue");

  const usage = await openInspectFold(page, "usage");
  for (const name of ["Welcome", "Details", "Toolbar"])
    await expect(
      usage.getByRole("link", { name, exact: true }).first(),
    ).toBeVisible();
  await usage
    .locator('a[href^="/view/example/components/toolbar/default/"]')
    .click();
  await expect(page).toHaveURL(
    /\/view\/example\/components\/toolbar\/default\/\?/u,
  );
  await expect(
    rowFrame("example/components/toolbar/default", "dark").locator(
      ".example-toolbar",
    ),
  ).toHaveCSS("border-radius", "12px");
  const nested = await openInspectFold(page, "components");
  await expect(nested.locator("[data-instance-key]")).toHaveCount(2);
  const highlight = page.getByRole("switch", {
    name: "Highlight components",
    exact: true,
  });
  await highlight.click();
  await expect(highlight).toBeChecked();
});

/**
 * Expect each frame of the top bar component to render its desktop view in
 * the frame's own scheme, whatever the Appearance: the canvas and the
 * compact layout show a component's desktop views, Light beside Dark.
 */
async function expectComponentViews(page: Page): Promise<void> {
  await page.goto("/view/design/library/chrome/top-bar/?viewport=both");
  const own = '[data-workspace-variant="design/library/chrome/top-bar"]';
  for (const scheme of ["light", "dark"] as const)
    await expect(
      page.locator(`${canvasFrame("desktop", scheme)}${own}`),
    ).toBeVisible();
  const light = page.frameLocator(`${canvasFrame("desktop")}${own}`);
  const dark = page.frameLocator(`${canvasFrame("desktop", "dark")}${own}`);
  // The top bar reads the viewport and scheme from its render context.
  for (const frame of [light, dark]) {
    await expect(frame.locator(".mbk-name")).toHaveText("mokly.");
    // The bar draws no menu, as the shell's bar does.
    await expect(frame.locator("[data-mokly-menu]")).toHaveCount(0);
  }
  await expect(dark.locator("html")).toHaveCSS("color-scheme", "dark");
  await expect(light.locator("html")).not.toHaveCSS("color-scheme", "dark");
  await chooseScheme(page, "dark");
  await expect(light.locator("html")).not.toHaveCSS("color-scheme", "dark");
  await expect(dark.locator("html")).toHaveCSS("color-scheme", "dark");
}

test("on the canvas, each frame of a component renders its desktop view in the frame's scheme", async ({
  page,
}) => {
  await expectComponentViews(page);
});

test("below the layout breakpoint, each frame of a component renders its desktop view in the frame's scheme", async ({
  page,
}) => {
  // The compact layout shows the component's whole set until a frame is
  // picked, so the component's own Light and Dark frames show.
  await page.setViewportSize(NARROW_WINDOW);
  await expectComponentViews(page);
});

test("Inspect folds Props and Usage, and only a composed component lists its nested components", async ({
  page,
}) => {
  // A leaf component folds Props and Usage, and has no Components section.
  await page.goto(ACTION);
  const folds = page.locator(".mbk-inspect-fold > summary");
  await expect(folds).toHaveText([/^Props\b/u, /^Usage\b/u]);
  await expect(page.locator('[data-inspect-section="components"]')).toHaveCount(
    0,
  );
  const usage = page.locator('[data-inspect-section="usage"]');
  await expect(usage).not.toHaveAttribute("open", "");
  await usage.locator(":scope > summary").click();
  await expect(usage).toHaveAttribute("open", "");
  await expect(usage.locator("[data-usage-section]").first()).toBeVisible();
  await usage.locator(":scope > summary").click();
  await expect(usage).not.toHaveAttribute("open", "");
  // A composed component also lists its nested components.
  await page.goto("/view/example/components/toolbar/");
  await expect(
    page.locator('[data-inspect-section="components"] > summary'),
  ).toHaveText(/^Nested components\b/u);
});
