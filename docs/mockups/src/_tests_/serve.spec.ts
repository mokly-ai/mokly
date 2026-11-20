import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

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

test("browse a settings pane over the stage and switch its theme", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(screenUrl("product/settings/project"));
  await expect(page.locator("iframe")).toHaveCount(2);
  for (const index of [0, 1])
    await expect(
      page
        .frameLocator("iframe")
        .nth(index)
        .locator('[data-mkc-screen="product/settings/project"]'),
    ).toBeVisible();
  const desktop = page.frameLocator("iframe").nth(1);
  await expect(desktop.locator(".fo-stage-canvas")).toBeVisible();
  await expect(desktop.locator('[role="dialog"]')).toBeVisible();
  const appearance = page.getByRole("combobox", { name: "Appearance" });
  await appearance.selectOption("dark");
  await expect(
    page.frameLocator("iframe").first().locator(wrapper),
  ).toHaveAttribute("data-color-scheme", "dark");
  await appearance.selectOption("light");
  await expect(
    page.frameLocator("iframe").first().locator(wrapper),
  ).toHaveAttribute("data-color-scheme", "light");
  await page
    .frameLocator("iframe")
    .nth(1)
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
    const frame = page.frameLocator("iframe").nth(1);
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
  const frame = page.frameLocator("iframe").nth(1);
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
