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
import { NARROW_WIDTH, openLargeText, scrollWidth } from "./large-text.js";

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

// Each test sets its own width, so the 390px projects would only repeat it.
for (const width of [1200, 1440, 1920]) {
  test(
    `at ${String(width)}px Version history has the place and the width of the docs Layers panel`,
    {
      tag: "@desktop",
    },
    async ({ page }) => {
      await page.setViewportSize({ height: 900, width });
      await page.goto(SITE_PATHS.docs);
      const layers = await page
        .getByRole("navigation", { name: "Documentation" })
        .boundingBox();
      await page.goto(SITE_PATHS.changelog);
      const panel = await history(page).boundingBox();
      if (!layers || !panel) throw new Error("a panel has no box");
      expect(panel.x).toBeCloseTo(layers.x, 0);
      expect(panel.y).toBeCloseTo(layers.y, 0);
      expect(panel.width).toBeCloseTo(layers.width, 0);
    },
  );
}

/** Each width from `from` to `to`, `step` apart. */
function widths(from: number, to: number, step = 1): number[] {
  const found: number[] = [];
  for (let width = from; width <= to; width += step) found.push(width);
  return found;
}

/**
 * Check every width just above the toolbar breakpoint, both sides of each
 * layout step, and a wider sample across the full width range.
 */
const SWEEPS: Readonly<Record<string, readonly number[]>> = {
  "every width from 768px to 797px": widths(768, 797),
  "both sides of each layout step": [
    767, 779, 799, 829, 933, 959, 1035, 1099, 1155, 1199, 1319, 1399, 1439,
  ].flatMap((edge) => [edge, edge + 1]),
  "every 80px from 320px to 1920px": widths(320, 1920, 80),
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

test(
  "at 200% text in a 320px window the changelog never scrolls sideways, with its disclosures closed or open",
  { tag: "@mobile" },
  async ({ page }) => {
    await openLargeText(page, SITE_PATHS.changelog);
    await expect
      .poll(() => scrollWidth(page))
      .toBeLessThanOrEqual(NARROW_WIDTH);
    // Every disclosure opens at once, so every note and upgrade note is laid
    // out; a reader opens them one by one.
    await page.evaluate(() => {
      for (const details of document.querySelectorAll("details"))
        details.open = true;
    });
    await expect
      .poll(() => scrollWidth(page))
      .toBeLessThanOrEqual(NARROW_WIDTH);
  },
);

for (const percent of [100, 200]) {
  test(
    `at ${percent}% text in a 320px window each filter option keeps its label and count inside itself and the bar`,
    { tag: "@mobile" },
    async ({ page }) => {
      await openLargeText(page, SITE_PATHS.changelog, percent);
      await expect(filter(page)).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      // The words of each option as laid out, against its box and the bar's.
      const { checked, misses } = await filter(page).evaluate((bar) => {
        const edge = bar.getBoundingClientRect();
        const options = [...bar.querySelectorAll("label")];
        const found = options.flatMap((option) => {
          const box = option.getBoundingClientRect();
          let left = Infinity;
          let right = -Infinity;
          const words = document.createTreeWalker(option, NodeFilter.SHOW_TEXT);
          for (let node = words.nextNode(); node; node = words.nextNode()) {
            if (!node.textContent?.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const rect of range.getClientRects()) {
              left = Math.min(left, rect.left);
              right = Math.max(right, rect.right);
            }
          }
          const inside = (outer: DOMRect) =>
            left >= outer.left - 0.5 && right <= outer.right + 0.5;
          if (inside(box) && inside(edge)) return [];
          const name = option.textContent?.trim().replace(/\s+/g, " ");
          return [
            `${name}: words ${left}..${right}, option ${box.left}..${box.right}, bar ${edge.left}..${edge.right}`,
          ];
        });
        return { checked: options.length, misses: found };
      });
      expect(checked).toBe(5);
      expect(misses).toEqual([]);
    },
  );
}

test.describe("without script", DESKTOP, () => {
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
