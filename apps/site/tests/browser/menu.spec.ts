import { type Locator, type Page, expect, test } from "@playwright/test";

import {
  EXTERNAL_LINKS,
  GET_STARTED_PATH,
  SITE_PATHS,
} from "../../src/navigation.js";

import { openMenu } from "./menu.js";
import { HEADINGS } from "./routes.js";

/** The menu's destinations, in reading order. */
const MENU_LINKS = [
  SITE_PATHS.docs,
  SITE_PATHS.changelog,
  SITE_PATHS.pricing,
  EXTERNAL_LINKS.github,
  GET_STARTED_PATH,
];

/** The menu control. The open menu makes it inert, so it is found by its relationship. */
function control(page: Page): Locator {
  return page.locator('button[aria-controls="site-menu"]');
}

/** Whether the dialog is open, read directly so a closing transition does not count. */
async function isOpen(menu: Locator): Promise<boolean> {
  return menu.evaluate((dialog) => (dialog as HTMLDialogElement).open);
}

test(
  "the menu opens as a modal sheet below the tool bar holding every destination",
  { tag: "@mobile" },
  async ({ page }) => {
    await page.goto(SITE_PATHS.home);
    await expect(control(page)).toHaveAttribute("aria-expanded", "false");
    const opener = await control(page).boundingBox();
    const bar = await page.getByRole("banner").boundingBox();
    const menu = await openMenu(page);
    expect(await menu.evaluate((dialog) => dialog.matches(":modal"))).toBe(
      true,
    );
    await expect(control(page)).toHaveAttribute("aria-expanded", "true");
    const close = menu.getByRole("button", { name: "Close menu" });
    await expect(close).toBeFocused();
    // The close control takes the place of the control that opened the menu.
    const closer = await close.boundingBox();
    for (const edge of ["x", "y", "width", "height"] as const)
      expect(closer?.[edge] ?? 0).toBeCloseTo(opener?.[edge] ?? -1, 0);
    // The sheet spans the window directly below the tool bar.
    const sheet = await menu.boundingBox();
    expect(sheet?.y ?? 0).toBeCloseTo((bar?.y ?? 0) + (bar?.height ?? -1), 0);
    expect([sheet?.x, sheet?.width]).toEqual([0, page.viewportSize()?.width]);
    expect(
      await menu
        .locator("a")
        .evaluateAll((anchors) =>
          anchors.map((anchor) => anchor.getAttribute("href")),
        ),
    ).toEqual(MENU_LINKS);
    await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
  },
);

test(
  "Escape closes the menu and returns focus to its control",
  { tag: "@mobile" },
  async ({ page }) => {
    await page.goto(SITE_PATHS.changelog);
    const menu = await openMenu(page);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(control(page)).toBeFocused();
    await expect(control(page)).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("html")).not.toHaveCSS("overflow", "hidden");
  },
);

test(
  "the close control and a press on the dimmed page close the menu",
  { tag: "@mobile" },
  async ({ page }) => {
    await page.goto(SITE_PATHS.docs);
    let menu = await openMenu(page);
    await menu.getByRole("button", { name: "Close menu" }).click();
    await expect(menu).toBeHidden();
    await expect(control(page)).toBeFocused();

    menu = await openMenu(page);
    const sheet = await menu.boundingBox();
    const height = page.viewportSize()?.height ?? 0;
    if (!sheet) throw new Error("the open menu has no box");
    // A press on the sheet's empty foot keeps the menu open.
    await page.mouse.click(
      sheet.x + sheet.width / 2,
      sheet.y + sheet.height - 8,
    );
    expect(await isOpen(menu)).toBe(true);
    // A press on the dimmed page below the sheet closes it.
    await page.mouse.click(
      sheet.x + sheet.width / 2,
      (sheet.y + sheet.height + height) / 2,
    );
    await expect(menu).toBeHidden();
  },
);

test(
  "a destination in the menu opens its page",
  { tag: "@mobile" },
  async ({ page }) => {
    await page.goto(SITE_PATHS.home);
    const menu = await openMenu(page);
    await menu.getByRole("link", { name: "Changelog" }).click();
    await expect(page).toHaveURL(new RegExp(`${SITE_PATHS.changelog}$`));
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 }),
    ).toHaveText(HEADINGS.get(SITE_PATHS.changelog) ?? "");
  },
);

test(
  "the menu closes when the desktop composition replaces it",
  { tag: "@mobile" },
  async ({ page }) => {
    await page.goto(SITE_PATHS.home);
    const menu = await openMenu(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(menu).toBeHidden();
    await expect(control(page)).toBeHidden();
    await expect(page.locator("html")).not.toHaveCSS("overflow", "hidden");
    // The page is no longer inert: the header row's own link works.
    await page
      .getByRole("banner")
      .getByRole("navigation", { exact: true, name: "Main" })
      .getByRole("link", { name: "Changelog" })
      .click();
    await expect(page).toHaveURL(new RegExp(`${SITE_PATHS.changelog}$`));
  },
);

test(
  "the menu closes when the reader leaves the page",
  { tag: "@mobile" },
  async ({ page }) => {
    await page.goto(SITE_PATHS.home);
    const menu = await openMenu(page);
    // The back and forward cache keeps the page as it was hidden.
    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: true }),
      ),
    );
    expect(await isOpen(menu)).toBe(false);
    await expect(menu).toBeHidden();
  },
);
