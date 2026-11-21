import { expect, test } from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";

import {
  DESKTOP,
  FULL_FRAMES,
  NOTE_ROWS,
  RELEASES,
  filter,
  frame,
  history,
} from "./changelog.js";

/**
 * The changelog's layout in a real browser: Version history under the tool
 * bar while the page scrolls, the widths at which the page never scrolls
 * sideways, and the page without script.
 */

test(
  "Version history stays 72px below the window top, under the tool bar, as the page scrolls",
  DESKTOP,
  async ({ page }) => {
    await page.goto(SITE_PATHS.changelog);
    await page.mouse.move(720, 600);
    await page.mouse.wheel(0, 2400);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(1600);
    const bar = await page.getByRole("banner").boundingBox();
    const panel = await history(page).boundingBox();
    const height = page.viewportSize()?.height ?? 0;
    if (!bar || !panel) throw new Error("the tool bar or the panel has no box");
    expect(panel.y).toBeGreaterThanOrEqual(bar.y + bar.height);
    expect(panel.y).toBeCloseTo(72, 0);
    expect(panel.y + panel.height).toBeLessThanOrEqual(height);
  },
);

/** Each width from `from` to `to`, `step` apart. */
function widths(from: number, to: number, step = 1): number[] {
  const found: number[] = [];
  for (let width = from; width <= to; width += step) found.push(width);
  return found;
}

/**
 * The widths the page is drawn at, in sweeps short enough for one test
 * each: every width from 768px to 797px, both sides of every layout step of
 * the page and of its tool bar, and every 40px from 320px to 1920px.
 */
const SWEEPS: Readonly<Record<string, readonly number[]>> = {
  "every width from 768px to 797px": widths(768, 797),
  "both sides of each layout step": [
    767, 779, 799, 829, 933, 959, 1035, 1099, 1155, 1199, 1275, 1395, 1399,
    1439,
  ].flatMap((edge) => [edge, edge + 1]),
  "every 40px from 320px to 1080px": widths(320, 1080, 40),
  "every 40px from 1120px to 1920px": widths(1120, 1920, 40),
};

for (const disclosures of ["closed", "open"] as const) {
  for (const [sweep, sizes] of Object.entries(SWEEPS)) {
    test(
      `the changelog never scrolls sideways at ${sweep}, with its disclosures ${disclosures}`,
      DESKTOP,
      async ({ page }) => {
        await page.goto(SITE_PATHS.changelog);
        await page.evaluate(() => document.fonts.ready);
        // Every disclosure opens at once, so every note and upgrade note is
        // laid out at each width; a reader opens them one by one.
        if (disclosures === "open")
          await page.evaluate(() => {
            for (const details of document.querySelectorAll("details"))
              details.open = true;
          });
        for (const width of sizes) {
          await page.setViewportSize({ width, height: 900 });
          await expect
            .poll(
              () => page.evaluate(() => document.documentElement.scrollWidth),
              { message: `${width}px` },
            )
            .toBeLessThanOrEqual(width);
        }
      },
    );
  }
}

test.describe("without script", () => {
  test.use({ javaScriptEnabled: false });

  test("every note shows and the filter does not", async ({ page }) => {
    await page.goto(SITE_PATHS.changelog);
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 }),
    ).toHaveText("What’s new in Mokly");
    await expect(filter(page)).toBeHidden();
    await expect(
      page.getByRole("main").getByRole("article").filter({ visible: true }),
    ).toHaveCount(RELEASES.length);
    const full = RELEASES.slice(0, FULL_FRAMES);
    await expect(page.locator(NOTE_ROWS).filter({ visible: true })).toHaveCount(
      full.reduce(
        (sum, release) =>
          sum +
          release.groups.reduce(
            (count, group) => count + group.notes.length,
            0,
          ),
        0,
      ),
    );
    // An earlier release holds its notes in a native disclosure, which opens
    // without script. The reader presses its summary, whose transparent band
    // for the 44px target lies over its words.
    const oldest = RELEASES.at(-1);
    if (oldest === undefined || oldest.groups.length === 0)
      throw new Error("the oldest release lists no notes");
    await frame(page, oldest.version)
      .locator("summary", { hasText: /^Show \d+ notes?/ })
      .click();
    await expect(
      frame(page, oldest.version).locator(NOTE_ROWS).filter({ visible: true }),
    ).toHaveCount(
      oldest.groups.reduce((sum, each) => sum + each.notes.length, 0),
    );
  });
});
