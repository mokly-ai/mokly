import { type Locator, type Page, expect, test } from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";

import {
  DESKTOP,
  DOWN_TO_END,
  expectNear,
  pageHeight,
  placed,
  settled,
  stepThrough,
  zoomPill,
} from "./home-zoom.js";
import { openLargeText } from "./large-text.js";

/**
 * The home's zoom where the browser draws classic scrollbars, which take
 * room beside and under the page, as Chrome does on Windows and Linux. As
 * the Zoom of docs/protocol/cloud/site-design-pages.md fixes it, at every
 * zoom the home keeps its layout of 100%, and the tool bar and the status
 * bar keep their width and their place, also once the zoom makes the page
 * fit the window's height. The pill keeps its place when the press back to
 * 100% removes the sideways scrollbar, and at 320px with 200% text each
 * zoom button keeps its whole target in the page.
 * `home-zoom.spec.ts` and `home-zoom-scale.spec.ts` check the zoom with
 * the hidden scrollbars of headless Chromium.
 */

// Playwright starts headless Chromium with hidden scrollbars. This file
// starts it with the scrollbars that the platform draws.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

/** The drawn box of each of `parts`, by name. */
async function boxes(
  parts: Readonly<Record<string, Locator>>,
): Promise<Record<string, { x: number; y: number; width: number }>> {
  const found: Record<string, { x: number; y: number; width: number }> = {};
  for (const [name, part] of Object.entries(parts)) {
    const box = await part.boundingBox();
    if (box === null) throw new Error(`${name} is not drawn`);
    found[name] = box;
  }
  return found;
}

/** The room that the window's vertical scrollbar takes beside the page. */
function scrollbarWidth(page: Page): Promise<number> {
  return page.evaluate(
    () => window.innerWidth - document.documentElement.clientWidth,
  );
}

/** Whether the window shows the page's end. */
function atPageEnd(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return Math.ceil(window.scrollY) >= root.scrollHeight - root.clientHeight;
  });
}

test(
  "with classic scrollbars the zoomed-out home keeps its width, and the bars and the pill keep their place",
  DESKTOP,
  async ({ page }) => {
    // In a 1280 × 1080 window the page fits the window's height from 11%.
    await page.setViewportSize({ height: 1080, width: 1280 });
    await page.goto(SITE_PATHS.home);
    const { group, zoomOut } = zoomPill(page);
    // The workspace is a layout box and the status bar a depiction, so
    // neither has a role.
    const workspace = page.locator(".site-home-workspace");
    const parts = {
      pill: group,
      "status bar": page.locator(".site-statusbar"),
      "tool bar": page.getByRole("banner"),
    };
    await zoomOut.focus();
    expect(
      await scrollbarWidth(page),
      "a scrollbar takes room",
    ).toBeGreaterThan(0);
    const own = (await placed(workspace)).own;
    const rest = await boxes(parts);
    for (const zoom of DOWN_TO_END) {
      await stepThrough(group, zoomOut, [zoom]);
      await settled(group);
      const workspaceNow = (await placed(workspace)).own;
      expect(workspaceNow, `${zoom}: the workspace's own size`).toEqual(own);
      const now = await boxes(parts);
      for (const [name, box] of Object.entries(rest))
        for (const side of ["x", "y", "width"] as const)
          expectNear(
            now[name]?.[side] ?? Number.NaN,
            box[side],
            `${zoom}: ${name}, ${side}`,
          );
    }
    expect(await pageHeight(page), "at 8% the page fits the window").toBe(1080);
  },
);

test(
  "with classic scrollbars the press back to 100% at the page's end leaves the pill in its place",
  DESKTOP,
  async ({ page }) => {
    await page.goto(SITE_PATHS.home);
    const { group, zoomIn, zoomOut } = zoomPill(page);
    await stepThrough(group, zoomIn, ["125%"]);
    // At 125% a sideways scrollbar shows under the page, and the reader
    // scrolls to the page's end.
    await page.mouse.move(640, 450);
    await page.mouse.wheel(0, 2000);
    await expect.poll(() => atPageEnd(page)).toBe(true);
    const before = await settled(group);
    await zoomOut.click();
    await expect(group).toHaveText("−100%+");
    expectNear((await settled(group)).y, before.y, "the pill's top");
  },
);

test(
  "at 320px with 200% text each zoom button's 44px target lies inside the page",
  { tag: "@mobile" },
  async ({ page }) => {
    await openLargeText(page, SITE_PATHS.home);
    const { group, zoomIn, zoomOut } = zoomPill(page);
    await expect(group).toBeVisible();
    for (const [name, button] of [
      ["Zoom out", zoomOut],
      ["Zoom in", zoomIn],
    ] as const) {
      // A press 21px left or right of the button's middle, on the outer
      // whole pixels of a 44px target, lands on it inside the page's width
      // without its scrollbar. Reading the topmost element at a point needs
      // the page's own hit testing, which no locator exposes.
      const reached = await button.evaluate((node) => {
        node.scrollIntoView({ block: "center" });
        const box = node.getBoundingClientRect();
        const middle = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        const inside = document.documentElement.clientWidth;
        return [middle - 21, middle + 21].map(
          (x) =>
            x >= 0 &&
            x < inside &&
            node.contains(document.elementFromPoint(x, y)),
        );
      });
      expect(reached, name).toEqual([true, true]);
    }
  },
);
