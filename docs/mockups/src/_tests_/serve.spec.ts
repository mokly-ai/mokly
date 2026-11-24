import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import type { FrameLocator, Page } from "@playwright/test";

import { viewHref } from "@mokly/viewer/data";

import { mockupsOrigin as origin } from "../../../../apps/mockups/src/_tests_/origins";

/** The served Browse address of one screen, derived from its path. */
function screenUrl(path: string): string {
  return origin + viewHref(path);
}
const screenshots = resolve(
  import.meta.dirname,
  "../../../../.context/mockups-smoke/served",
);

/** The renderer's wrapper, which carries a document's scheme and viewport. */
const wrapper = "[data-color-scheme][data-viewport]";

/**
 * The document of one frame of a screen on Browse's canvas, by the label
 * that the frame shows, such as `Desktop · Light`. The canvas shows the
 * screen's Desktop and Mobile frames in Light and in Dark at once.
 */
function canvasFrame(page: Page, label: string): FrameLocator {
  return page
    .getByRole("figure", { name: label })
    .locator("iframe")
    .contentFrame();
}

test("browse a settings pane on the canvas in both schemes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(screenUrl("product/settings/project"));
  await expect(page.locator("iframe")).toHaveCount(4);
  for (const [label, viewport, scheme] of [
    ["Mobile · Light", "mobile", "light"],
    ["Desktop · Light", "desktop", "light"],
    ["Mobile · Dark", "mobile", "dark"],
    ["Desktop · Dark", "desktop", "dark"],
  ] as const) {
    const frame = canvasFrame(page, label);
    await expect(
      frame.locator('[data-mkc-screen="product/settings/project"]'),
    ).toBeVisible();
    await expect(frame.locator(wrapper)).toHaveAttribute(
      "data-color-scheme",
      scheme,
    );
    await expect(frame.locator(wrapper)).toHaveAttribute(
      "data-viewport",
      viewport,
    );
  }
  const desktop = canvasFrame(page, "Desktop · Light");
  await expect(desktop.locator(".fo-stage-canvas")).toBeVisible();
  await expect(desktop.locator('[role="dialog"]')).toBeVisible();
  await desktop
    .getByRole("link", { name: "Publishing tokens", exact: true })
    .click();
  await expect(page).toHaveURL(screenUrl("product/settings/tokens"));
  expect(errors).toEqual([]);
});

test("every settings pane is reachable from the dialog rail", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(screenUrl("product/settings/account"));
  mkdirSync(screenshots, { recursive: true });
  for (const [label, pane] of [
    ["Workspace", "workspace"],
    ["Members", "members"],
    ["Billing", "billing"],
    ["Project", "project"],
    ["Publishing tokens", "tokens"],
    ["Access", "access"],
    ["Delete project", "danger"],
    ["Account", "account"],
  ] as const) {
    const frame = canvasFrame(page, "Desktop · Light");
    await frame
      .getByRole("navigation", { name: "Settings sections" })
      .getByRole("link", { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(screenUrl("product/settings/" + pane));
    await expect(
      frame.locator('[data-mkc-screen="product/settings/' + pane + '"]'),
    ).toBeVisible();
  }
  await page.screenshot({
    path: resolve(screenshots, "settings-rail.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("account entry keeps keyboard focus and reaches sign in", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(screenUrl("product/account/sign-up"));
  const frame = canvasFrame(page, "Desktop · Light");
  await expect(frame.locator(wrapper)).toHaveAttribute(
    "data-viewport",
    "desktop",
  );
  await frame.getByLabel("Email", { exact: true }).fill("reviewer@example.com");
  await frame.getByLabel("Email", { exact: true }).press("Tab");
  await expect(
    frame.getByRole("button", { name: "Continue with email" }),
  ).toBeFocused();
  await frame
    .locator(".fo-account-switch")
    .getByRole("link", { name: "Sign in" })
    .click();
  await expect(page).toHaveURL(screenUrl("product/account/sign-in"));
  await expect(
    frame.getByRole("heading", { name: "Sign in to Mokly" }),
  ).toBeVisible();
});
