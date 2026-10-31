/**
 * The inspector's sheet and handles in the shell stylesheet, which bundles
 * the `@mokly/ui` rules. Below the layout breakpoint the sheet spans its
 * workspace's full width, as the shell design asks. The resize grip and the
 * sheet's grabber are controls, so they draw the control edge, as the palette
 * contract asks.
 */

import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { renderWithShellStyles } from "./shell_styles_page.js";

/** The Light palette's control edge. */
const CONTROL_EDGE = "rgb(134, 142, 136)";

test.use({ colorScheme: "light" });

test("below the layout breakpoint the sheet spans its workspace, and its grabber draws the control edge", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await renderWithShellStyles(
    page,
    new URL("./inspector_sheet_forms.tsx", import.meta.url),
  );
  const workspace = (await page.locator("[data-workspace]").boundingBox())!;
  const sheet = (await page
    .getByRole("region", { name: "Inspector" })
    .boundingBox())!;
  expect(sheet.x).toBe(workspace.x);
  expect(sheet.width).toBe(workspace.width);
  const grabber = page.getByRole("button", { name: "Expand inspector" });
  await expect(grabber.locator("span")).toHaveCSS(
    "background-color",
    CONTROL_EDGE,
  );
  await expect(grabber.locator("span")).toHaveCSS("opacity", "1");
});

test("on a wide screen the resize grip draws the control edge", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await renderWithShellStyles(
    page,
    new URL("./inspector_sheet_forms.tsx", import.meta.url),
  );
  const grip = page.getByRole("separator", { name: "Resize inspector" });
  await expect(grip).toBeVisible();
  expect(
    await grip.evaluate(
      (node) => getComputedStyle(node, "::after").backgroundColor,
    ),
  ).toBe(CONTROL_EDGE);
});
