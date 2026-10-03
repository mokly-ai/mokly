import { expect, test } from "@playwright/test";

import { chooseViewport } from "./workspace_actions.js";

const family = "/view/design/browse/index-entries";

test("desktop index entry designs link the folder screen, its member, and their Changes states", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/view/design/browse/views/screen/");
  await chooseViewport(page, "desktop");
  const frame = page.frameLocator(".mbk-frame-desktop iframe");
  const nav = frame.locator("nav.mbk-nav");
  const filter = frame.getByRole("group", { name: "Catalogue filter" });
  await nav.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${family}/screen/$`));
  await expect(
    nav.getByRole("button", { name: "Hide contents of Profile" }),
  ).toHaveAttribute("aria-expanded", "true");
  await nav.getByRole("link", { name: "Security", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${family}/member/$`));
  await frame
    .getByLabel("Catalogue location")
    .getByRole("link", { name: "Profile", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`${family}/screen/$`));
  await filter.getByRole("link", { name: /^Changes/ }).click();
  await expect(page).toHaveURL(new RegExp(`${family}/screen-changes/$`));
  await nav.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${family}/member-changes/$`));
  await filter.getByRole("link", { name: "All", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${family}/member/$`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${family}/member-changes/$`));
  await expect(
    page.locator(
      'a[data-nav-row][data-route="design/browse/index-entries/member-changes/index.html"]',
    ),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator("[data-mokly-stage]")).toHaveAttribute(
    "data-viewport",
    "desktop",
  );
});

test("narrow index entry designs reach the folder screen from the drawer and a member's crumb", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`${family}/member/`);
  await chooseViewport(page, "mobile");
  const frame = page.frameLocator(".mbk-frame-mobile iframe");
  await frame
    .getByLabel("Catalogue location")
    .getByRole("link", { name: "Profile", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`${family}/screen/$`));
  await frame.getByRole("link", { name: "Open catalogue navigation" }).click();
  await expect(page).toHaveURL(/\/view\/design\/browse\/states\/navigation\/$/);
  await expect(
    frame.getByRole("button", { name: "Show contents of Profile" }),
  ).toHaveAttribute("aria-expanded", "false");
  await frame
    .locator("nav.mbk-nav")
    .getByRole("link", { name: "Profile", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`${family}/screen/$`));
});
