import { type Locator, type Page, expect, test } from "@playwright/test";

import { NARROW_WIDTH, openLargeText } from "./large-text.js";
import { settle } from "./menu.js";

/**
 * The sub-bar's Layers control. The open sheet makes the page behind it
 * inert, so the control is found by its relationship to the sheet.
 */
function control(page: Page): Locator {
  return page.locator('button[aria-controls="docs-layers"]');
}

/** Open the tree sheet from the sub-bar and wait until it has settled. */
async function openSheet(page: Page): Promise<Locator> {
  await control(page).click();
  const sheet = page.getByRole("dialog", { name: "Layers" });
  await expect(sheet).toBeVisible();
  await settle(sheet);
  return sheet;
}

test(
  "the Layers control opens the tree sheet under the sub-bar at the current page",
  { tag: "@mobile" },
  async ({ page }) => {
    await page.goto("/docs/review/agent-sessions/");
    await expect(control(page)).toHaveAttribute("aria-expanded", "false");
    const sheet = await openSheet(page);
    expect(await sheet.evaluate((dialog) => dialog.matches(":modal"))).toBe(
      true,
    );
    await expect(control(page)).toHaveAttribute("aria-expanded", "true");
    // The sheet drops in under the 60px tool bar and the 52px sub-bar.
    expect((await sheet.boundingBox())?.y).toBeCloseTo(112, 0);
    // The current page's row, low in the tree, is revealed with the
    // smallest scroll: it comes to rest on the tree's lower edge.
    const row = sheet.getByRole("link", { name: "Agent sessions" });
    await expect(row).toHaveAttribute("aria-current", "page");
    await expect(row).toBeInViewport({ ratio: 1 });
    const below = await row.evaluate((link) => {
      const tree = link.closest(".site-doc-tree-scroll");
      if (!tree) throw new Error("the row is outside the scrolling tree");
      return (
        tree.getBoundingClientRect().bottom -
        link.getBoundingClientRect().bottom
      );
    });
    expect(Math.abs(below)).toBeLessThan(1);
    await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
  },
);

test(
  "Escape, the scrim, the control's place and a tree link close the tree sheet",
  { tag: "@mobile" },
  async ({ page }) => {
    await page.goto("/docs/start/install/");
    let sheet = await openSheet(page);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(control(page)).toBeFocused();
    await expect(control(page)).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("html")).not.toHaveCSS("overflow", "hidden");

    // A press on the dimmed page below the sheet closes it.
    sheet = await openSheet(page);
    const box = await sheet.boundingBox();
    const height = page.viewportSize()?.height ?? 0;
    if (!box) throw new Error("the open sheet has no box");
    await page.mouse.click(
      box.x + box.width / 2,
      (box.y + box.height + height) / 2,
    );
    await expect(sheet).toBeHidden();

    // The open sheet leaves the sub-bar undimmed but inert, so a press on
    // the control's place lands on the scrim and closes the sheet too.
    const opener = await control(page).boundingBox();
    if (!opener) throw new Error("the Layers control has no box");
    sheet = await openSheet(page);
    await page.mouse.click(
      opener.x + opener.width / 2,
      opener.y + opener.height / 2,
    );
    await expect(sheet).toBeHidden();
    await expect(control(page)).toHaveAttribute("aria-expanded", "false");

    sheet = await openSheet(page);
    await sheet.getByRole("link", { name: "Configure" }).click();
    await expect(page).toHaveURL(/\/docs\/start\/configure\/$/);
  },
);

test(
  "the tree sheet closes when the reader leaves the page and when the Layers panel takes over",
  { tag: "@mobile" },
  async ({ page }) => {
    await page.goto("/docs/start/install/");
    let sheet = await openSheet(page);
    // The back and forward cache keeps the page as it was hidden.
    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: true }),
      ),
    );
    await expect(sheet).toBeHidden();

    sheet = await openSheet(page);
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(sheet).toBeHidden();
    await expect(page.locator("html")).not.toHaveCSS("overflow", "hidden");
    // The page is no longer inert: the Layers panel's own link works.
    await page
      .getByRole("navigation", { name: "Documentation" })
      .getByRole("link", { name: "Configure" })
      .click();
    await expect(page).toHaveURL(/\/docs\/start\/configure\/$/);
  },
);

test(
  "at 200% text in a 320px window the tree sheet's rows fit the window and show whole page names",
  { tag: "@mobile" },
  async ({ page }) => {
    await openLargeText(page, "/docs/cli/options-and-exit-status/");
    const sheet = await openSheet(page);
    const rows = sheet.getByRole("link");
    expect(await rows.count()).toBeGreaterThan(40);
    // Reading every row's box at once: a row scrolled out of the tree still
    // has its width.
    const misses = await rows.evaluateAll(
      (links, width) =>
        links.flatMap((link) => {
          const box = link.getBoundingClientRect();
          const label = link.querySelector(".site-panel-row-label") ?? link;
          const name = link.textContent?.trim() ?? "";
          if (box.left < 0 || box.right > width)
            return [`${name}: ${box.right}`];
          if (label.scrollWidth > label.clientWidth + 1)
            return [`${name}: cut`];
          return [];
        }),
      NARROW_WIDTH,
    );
    expect(misses).toEqual([]);
  },
);
