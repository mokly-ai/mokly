import { expect } from "@playwright/test";

import { staticRequests } from "./static_delivery_assertions.js";
import { test } from "./static_test.js";
import {
  canvasFrame,
  chooseScheme,
  chooseVariant,
  chooseViewport,
  expectFrameSource,
  NARROW_WINDOW,
} from "./workspace_actions.js";

/**
 * The frame of a saved variant of Action: its row's frame of the scheme on
 * the canvas, which shows desktop views, or below the layout breakpoint the
 * one frame of the viewport, in the chosen scheme.
 */
function variantFrame(
  viewport: "desktop" | "mobile",
  variant: string,
  scheme: "dark" | "light" = "light",
): string {
  return viewport === "desktop"
    ? `${canvasFrame("desktop", scheme)}[data-workspace-variant="example/components/action/${variant}"]`
    : `[data-workspace-frame="${viewport}"]`;
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: copied saved variants and instance inspection work with read-only props`, async ({
    page,
  }) => {
    // The canvas shows a component's desktop views; its mobile views show
    // on the one-frame stage below the layout breakpoint.
    if (viewport === "mobile") await page.setViewportSize(NARROW_WINDOW);
    const requests = staticRequests(page);
    await page.goto("/view/example/components/action/disabled/");
    await chooseViewport(page, viewport);
    await page.getByRole("tab", { name: "Props", exact: true }).click();
    const props = page.getByRole("tabpanel", { name: "Props", exact: true });
    await expect(
      props.getByRole("heading", { name: "Saved props" }),
    ).toBeVisible();
    await expect(props).toContainText(
      "Open this catalogue locally to edit props.",
    );
    await expect(props.locator("input, textarea, select")).toHaveCount(0);
    const frame = page.frameLocator(variantFrame(viewport, "disabled"));
    await expect(frame.getByRole("button").first()).toBeDisabled();
    await chooseScheme(page, "dark");
    await expectFrameSource(
      page.locator(variantFrame(viewport, "disabled", "dark")),
      new RegExp(`/disabled/index\\.${viewport}\\.dark\\.html$`),
    );
    await chooseVariant(page, "Default");
    await expect(page).toHaveURL(
      /\/view\/example\/components\/action\/default\/$/,
    );
    await expect(
      page
        .frameLocator(variantFrame(viewport, "default"))
        .getByRole("button")
        .first(),
    ).toBeEnabled();
    await page.getByRole("tab", { name: "Usage", exact: true }).click();
    await page
      .getByRole("tabpanel", { name: "Usage", exact: true })
      .getByRole("link", { name: "Welcome", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(
      /\/view\/example\/screens\/welcome\/\?.*instance=/,
    );
    await expect(
      page.getByRole("tabpanel", { name: "Props", exact: true }),
    ).toContainText("Action");
    const highlight = page.getByRole("button", {
      name: "Highlight components",
      exact: true,
    });
    await expect(highlight).toBeEnabled();
    await highlight.click();
    // The switch draws on every shown frame: on the canvas, each scheme's.
    await expect(page.locator(".mbk-highlight-layer").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
    await page
      .getByRole("link", { name: "Open component", exact: true })
      .click();
    await expect(page.locator("#mb-main h2")).toHaveText("Action");
    requests.assert();
  });
}
