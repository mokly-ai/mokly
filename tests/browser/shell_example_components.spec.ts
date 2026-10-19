/**
 * The example's React components in the shell on the example Serve host,
 * under the component explorer and controls contracts: live edits through
 * the sidecar with their Usage consumers, each view's actual render context,
 * and the inspector icons.
 */

import { expect, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import { chooseScheme } from "./workspace_actions.js";

const ACTION = "/view/example/components/action/";

/** Open an inspector panel; a click on the selected icon would close it. */
async function openPanel(page: Page, name: string) {
  const tab = page.getByRole("tab", { name, exact: true });
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
      await page.getByRole("button", { name: "Expand inspector" }).click();
    const frame = page.frameLocator(`[data-workspace-frame="${viewport}"]`);
    const label = props.getByLabel("Label", { exact: true });
    await expect(label).toBeEditable();
    await label.fill("Ready to continue");
    const button = frame.getByRole("button", {
      name: "Ready to continue",
      exact: true,
    });
    await expect(button).toBeVisible();
    // The optional radius is set in the saved props, so its field shows.
    await props.locator('[data-prop-control="radius"]').fill("24");
    await expect(button).toHaveCSS("border-radius", "24px");
    // A scheme change keeps the edit and renders it in the dark view.
    await chooseScheme(page, "dark");
    await expect(frame.locator("html")).toHaveCSS("color-scheme", "dark");
    await expect(button).toHaveCSS("border-radius", "24px");
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
    await expect(frame.locator(".example-toolbar")).toHaveCSS(
      "border-radius",
      "12px",
    );
    const nested = await openPanel(page, "Nested components");
    await expect(nested.locator("[data-instance-key]")).toHaveCount(2);
    const highlight = page.getByRole("button", {
      name: "Highlight components",
      exact: true,
    });
    await highlight.click();
    await expect(highlight).toHaveAttribute("aria-pressed", "true");
  });

test("each view of a component renders in its actual viewport and scheme", async ({
  page,
}) => {
  await page.goto("/view/design/library/chrome/top-bar/?viewport=both");
  const mobile = page.frameLocator('[data-workspace-frame="mobile"]');
  const desktop = page.frameLocator('[data-workspace-frame="desktop"]');
  // The top bar reads the viewport and scheme from its render context.
  await expect(mobile.locator(".mbk-menu-btn")).toBeVisible();
  await expect(mobile.locator(".mbk-name")).toHaveCount(0);
  await expect(desktop.locator(".mbk-name")).toHaveText("mokly.");
  await expect(desktop.locator(".mbk-menu-btn")).toHaveCount(0);
  await chooseScheme(page, "dark");
  for (const frame of [mobile, desktop])
    await expect(frame.locator("html")).toHaveCSS("color-scheme", "dark");
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
