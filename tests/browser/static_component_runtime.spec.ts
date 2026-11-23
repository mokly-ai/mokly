import { expect } from "@playwright/test";

import { showProps } from "./live_props.js";
import { staticRequests } from "./static_delivery_assertions.js";
import { test } from "./static_test.js";
import {
  canvasFrame,
  chooseScheme,
  chooseVariant,
  chooseViewport,
  expectFrameSource,
  NARROW_WINDOW,
  openInspectFold,
} from "./workspace_actions.js";

/**
 * The frame of a saved variant of Action: its row's frame of the scheme. The
 * canvas and the compact layout show a component's desktop views, and the
 * compact layout shows the routed variant's frame of the chosen scheme.
 */
function variantFrame(
  variant: string,
  scheme: "dark" | "light" = "light",
): string {
  return `${canvasFrame("desktop", scheme)}[data-workspace-variant="example/components/action/${variant}"]`;
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: copied saved variants and instance inspection work with read-only props`, async ({
    page,
  }) => {
    // A mobile viewport choice leaves a component's desktop views on the
    // canvas, and below the layout breakpoint in the compact layout too.
    if (viewport === "mobile") await page.setViewportSize(NARROW_WINDOW);
    const requests = staticRequests(page);
    await page.goto("/view/example/components/action/disabled/");
    await chooseViewport(page, viewport);
    // The routed saved variant's frame is selected, so Props shows its row.
    const props = await showProps(page);
    await expect(
      props.getByRole("heading", { name: "Saved props" }),
    ).toBeVisible();
    await expect(props).toContainText(
      "Open this catalogue locally to edit props.",
    );
    await expect(props.locator("input, textarea, select")).toHaveCount(0);
    const frame = page.frameLocator(variantFrame("disabled"));
    await expect(frame.getByRole("button").first()).toBeDisabled();
    await chooseScheme(page, "dark");
    const dark = page.locator(variantFrame("disabled", "dark"));
    await expect(dark).toBeVisible();
    await expectFrameSource(dark, /\/disabled\/index\.desktop\.dark\.html$/);
    // A row of Variants selects that row's frame, in the chosen scheme in
    // the compact layout.
    await chooseVariant(page, "Default");
    await expect(
      page.locator('[data-inspect-section="variants"] [data-checked]'),
    ).toHaveText("Default");
    await expect(
      page
        .frameLocator(variantFrame("default", "dark"))
        .getByRole("button")
        .first(),
    ).toBeEnabled();
    const usage = await openInspectFold(page, "usage");
    await usage
      .getByRole("link", { name: "Welcome", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(
      /\/view\/example\/screens\/welcome\/\?.*instance=/,
    );
    // The link selects its instance, which Inspect's Selection names.
    const selection = page.locator('[data-inspect-section="selection"]');
    await expect(selection).toContainText("Action");
    const highlight = page.getByRole("switch", {
      name: "Highlight components",
      exact: true,
    });
    await expect(highlight).toBeEnabled();
    await highlight.click();
    // The switch draws on every shown frame: on the canvas, each scheme's.
    await expect(page.locator(".mbk-highlight-layer").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
    await selection.getByRole("link", { name: "Action", exact: true }).click();
    await expect(page.locator("#mb-main h2")).toHaveText("Action");
    requests.assert();
  });
}
