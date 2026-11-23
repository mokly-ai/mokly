import type { Route } from "@playwright/test";

import { signInPath } from "../../navigation/paths";
import { apiFailure } from "../api-responses";
import { expect, open, test } from "../harness";
import { apiOrigin, appOrigin } from "../origins";

import {
  openAccountMenu,
  publishedProject,
  publishedViewerReady,
} from "./support";

test("the bar ends with the avatar, which opens the account menu, and has no Settings", async ({
  page,
}) => {
  const made = await publishedProject(page, "account-menu");
  await open(page, made.publicationPath);
  await publishedViewerReady(page);
  const address = page.url();
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toHaveCount(0);
  const avatar = page.getByTestId("viewer-account");
  await expect(avatar).toHaveAccessibleName(made.email);
  await expect(avatar).toHaveAttribute("aria-expanded", "false");

  const menu = await openAccountMenu(page);
  await expect(avatar).toHaveAttribute("aria-expanded", "true");
  const surface = page.getByRole("dialog", { name: "Account" });
  // A reader with no name is named by their address, once.
  await expect(surface.getByText(made.email, { exact: true })).toHaveCount(1);
  await expect(
    surface.getByRole("radiogroup", { name: "Theme" }).getByRole("radio"),
  ).toHaveText(["Light", "Dark"]);
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Settings",
    "Docs",
    "Changelog",
    "Sign out",
  ]);
  // Docs and Changelog are links to the site's pages.
  await expect(
    menu.getByRole("menuitem", { name: "Docs", exact: true }),
  ).toHaveAttribute("href", appOrigin + "/docs/");
  await expect(
    menu.getByRole("menuitem", { name: "Changelog", exact: true }),
  ).toHaveAttribute("href", appOrigin + "/changelog/");
  // The menu is not an overlay: the address stays, and the viewer beneath
  // keeps its landmark and heading.
  expect(page.url()).toBe(address);
  await expect(page.locator("#root")).not.toHaveAttribute("inert", "");
  await expect(page.locator("#main")).toHaveAttribute("role", "main");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});

test("the keyboard opens the account menu on Settings, moves through its items and closes back on the avatar", async ({
  page,
}) => {
  const made = await publishedProject(page, "account-keys");
  await open(page, made.publicationPath);
  await publishedViewerReady(page);
  const avatar = page.getByTestId("viewer-account");
  const item = (name: string) =>
    page.getByRole("menuitem", { name, exact: true });
  await avatar.focus();
  await page.keyboard.press("Enter");
  await expect(item("Settings")).toBeFocused();
  for (const [key, name] of [
    ["ArrowDown", "Docs"],
    ["ArrowDown", "Changelog"],
    ["ArrowDown", "Sign out"],
    ["ArrowDown", "Settings"],
    ["ArrowUp", "Sign out"],
    ["Home", "Settings"],
    ["End", "Sign out"],
  ] as const) {
    await page.keyboard.press(key);
    await expect(item(name), `${key} to ${name}`).toBeFocused();
  }
  // Theme is the menu's other tab stop.
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("radio", { name: "Light" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(item("Sign out")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "Account" })).toHaveCount(0);
  await expect(avatar).toBeFocused();
  await expect(avatar).toHaveAttribute("aria-expanded", "false");

  // Enter on a link follows it, in this tab.
  await page.keyboard.press("Enter");
  await expect(item("Settings")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(item("Docs")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(appOrigin + "/docs/");
});

test("Theme applies at once and stays on the device, and the previews keep the system's scheme", async ({
  page,
}) => {
  const made = await publishedProject(page, "account-theme");
  await page.emulateMedia({ colorScheme: "light" });
  await open(page, `${made.publicationPath}?catalogueScreen=start`);
  await publishedViewerReady(page);
  const root = page.locator("html");
  const shell = page.locator("[data-mokly-shell]");
  const expectSchemes = async (app: string, previews: string) => {
    await expect(root).toHaveAttribute("data-color-scheme", app);
    await expect(shell).toHaveAttribute("data-mokly-theme", app);
    await expect(shell).toHaveAttribute("data-mokly-color-scheme", previews);
  };
  await expectSchemes("light", "light");

  await openAccountMenu(page);
  await page.getByRole("radio", { name: "Dark" }).click();
  await expectSchemes("dark", "light");
  // The choice keeps the menu open, so the reader can change it back.
  await expect(page.getByRole("menu", { name: "Account" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
  await expect(page).not.toHaveURL(/scheme=/);

  await page.reload();
  await publishedViewerReady(page);
  await expectSchemes("dark", "light");

  // The choice holds over the system preference, which the previews follow.
  await page.emulateMedia({ colorScheme: "dark" });
  await expectSchemes("dark", "dark");
  await openAccountMenu(page);
  await page.getByRole("radio", { name: "Light" }).click();
  await expectSchemes("light", "dark");
});

test("Settings opens the settings index, and closing it returns focus to the avatar, or to More on the compact bar", async ({
  page,
}) => {
  const made = await publishedProject(page, "account-settings");
  await open(page, made.publicationPath);
  await publishedViewerReady(page);
  const dialog = page.getByTestId("settings-dialog");
  for (const [width, trigger] of [
    [1440, "viewer-account"],
    [960, "viewer-more"],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByTestId(trigger).click();
    await page
      .getByRole("menu", { name: "Account" })
      .getByRole("menuitem", { name: "Settings", exact: true })
      .click();
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("menu", { name: "Account" })).toHaveCount(0);
    // The menu's Settings names no pane.
    await expect(page).toHaveURL(/[?&]settings=(?:&|$)/);
    await expect(
      dialog.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeVisible();
    await page.getByTestId("close-settings").click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId(trigger), `${width}px`).toBeFocused();
  }
});

test("Sign out ends the session, and a failure opens the Account pane", async ({
  page,
}) => {
  const made = await publishedProject(page, "account-sign-out");
  await open(page, made.publicationPath);
  await publishedViewerReady(page);
  const sessionUrl = `${apiOrigin}/v1/session`;
  const refuse = async (route: Route) => {
    if (route.request().method() !== "DELETE") return route.continue();
    const answer = apiFailure("unavailable");
    return route.fulfill({
      status: answer.status,
      contentType: "application/json",
      body: answer.body,
    });
  };
  await page.route(sessionUrl, refuse);
  const menu = await openAccountMenu(page);
  await menu.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/[?&]settings=account(?:&|$)/);
  await expect(
    page
      .getByTestId("settings-dialog")
      .getByRole("heading", { level: 1, name: "Account" }),
  ).toBeVisible();
  await page.unroute(sessionUrl, refuse);

  await page.getByTestId("close-settings").click();
  await expect(page.getByTestId("viewer-account")).toBeFocused();
  await (
    await openAccountMenu(page)
  )
    .getByRole("menuitem", { name: "Sign out", exact: true })
    .click();
  await expect(page).toHaveURL((url) => url.pathname === signInPath);
  expect((await page.request.get(sessionUrl)).status()).toBe(401);
});
