/**
 * The example's React components in the shell on the example Serve host,
 * under the component explorer and controls contracts: live edits through
 * the sidecar with their Usage consumers, each view's actual render context,
 * and the inspector icons.
 */

import { expect, type FrameLocator, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import {
  canvasFrame,
  chooseScheme,
  NARROW_WINDOW,
  revealInPanel,
} from "./workspace_actions.js";

const ACTION = "/view/example/components/action/";

/**
 * Open an inspector panel; a click on the selected icon would close it. In
 * the compact layout the inspector stands in the panel's sheet.
 */
async function openPanel(page: Page, name: string) {
  const tab = page.getByRole("tab", { name, exact: true });
  await revealInPanel(page, tab);
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  return page.getByRole("tabpanel", { name, exact: true });
}

for (const viewport of ["desktop", "mobile"] as const)
  test(`${viewport}: the example's React action renders live edits and lists its Usage consumers`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "desktop"
        ? { width: 1280, height: 900 }
        : { width: 390, height: 844 },
    );
    await page.goto(`${ACTION}?viewport=${viewport}`);
    const props = await openPanel(page, "Props");
    if (viewport === "mobile")
      await page.getByRole("button", { name: "Expand panel" }).click();
    // A row of the variant set shows the edit in its Light and Dark frames,
    // on the canvas and in the compact layout, which shows the whole set.
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

    const usage = await openPanel(page, "Usage");
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
    const nested = await openPanel(page, "Nested components");
    await expect(nested.locator("[data-instance-key]")).toHaveCount(2);
    const highlight = page.getByRole("button", {
      name: "Highlight components",
      exact: true,
    });
    await highlight.click();
    await expect(highlight).toHaveAttribute("aria-pressed", "true");
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
    await expect(frame.locator(".mbk-menu")).toBeHidden();
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

test("the inspector icons open, switch, and close panels, and only a composed component lists nested components", async ({
  page,
}) => {
  // A leaf component has Details, Props, and Usage, and Details opens first.
  await page.goto(ACTION);
  await expect(page.getByRole("tab")).toHaveCount(3);
  for (const name of ["Details", "Props", "Usage"])
    await expect(page.getByRole("tab", { name, exact: true })).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Details", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("tab", { name: "Nested components" }),
  ).toHaveCount(0);
  const usage = page.getByRole("tab", { name: "Usage", exact: true });
  await usage.click();
  await expect(usage).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Usage" })).toBeVisible();
  // The active icon collapses its panel, and Close collapses any panel.
  await usage.click();
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(
    0,
  );
  await openPanel(page, "Props");
  await page.getByRole("button", { name: "Close inspector" }).click();
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(
    0,
  );
  // A composed component also lists its nested components.
  await page.goto("/view/example/components/toolbar/");
  await expect(
    page.getByRole("tab", { name: "Nested components", exact: true }),
  ).toBeVisible();
});

test("Escape in another shell control closes the inspector and returns focus to the tab that opened it", async ({
  page,
}) => {
  await page.goto(ACTION);
  const usage = page.getByRole("tab", { name: "Usage", exact: true });
  await usage.click();
  await expect(usage).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("tabpanel", { name: "Usage", exact: true }),
  ).toBeVisible();
  // Escape reaches the inspector from any control of its shell.
  const search = page.getByRole("searchbox", { name: "Search catalogue" });
  await search.focus();
  await expect(search).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-workspace-inspector]")).toHaveAttribute(
    "data-open",
    "false",
  );
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(
    0,
  );
  await expect(page.getByRole("tabpanel")).toHaveCount(0);
  await expect(usage).toBeFocused();
});
