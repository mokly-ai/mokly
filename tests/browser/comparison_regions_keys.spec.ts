/**
 * Region keys on the copied comparison output, under the comparison
 * scrolling contract. In the regions page, a focused code panel keeps its
 * keys until it ends and then the page moves; ArrowLeft and ArrowRight
 * follow a right-to-left strip; and a script scroll of a two-axis grid moves
 * the lower version at once, even with smooth-scroll CSS everywhere.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import {
  comparisonSection,
  documentExtent,
  expectRegionsAt,
  expectRegionsAtRest,
  expectStackAt,
  openComparison,
  paneFrame,
  regionOffsets,
  regionRange,
  sampleFrames,
} from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";

const regionsPage = comparisonPaths.regionsPage;

/**
 * Press a key from a region's resting offset, then wait until both versions
 * rest at the expected offset, or at any new offset when none is given.
 */
async function pressTogether(
  page: Page,
  section: Locator,
  key: string,
  selector: string,
  expected?: (from: number) => number,
): Promise<void> {
  const from = await expectRegionsAtRest(section, selector, () => true);
  await page.keyboard.press(key);
  await expectRegionsAtRest(
    section,
    selector,
    (offset) => (expected ? offset === expected(from) : offset !== from),
    key,
  );
}

test("a focused panel keeps its keys until it ends, then the page moves", async ({
  page,
}) => {
  await openComparison(page, regionsPage, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  const top = paneFrame(desktop, "after");
  await top.contentFrame().locator("#rg-code").focus();
  await pressTogether(page, desktop, "PageDown", "#rg-code");
  const end = await regionRange(top, "#rg-code");
  await pressTogether(page, desktop, "End", "#rg-code", () => end);
  await expectStackAt(desktop, 0);
  const { height } = await documentExtent(top);
  await page.keyboard.press("PageDown");
  await expectStackAt(desktop, Math.floor(height * 0.875));
  await expectRegionsAt(desktop, "#rg-code", [end, end]);
});

test("ArrowLeft and ArrowRight follow a right-to-left panel", async ({
  page,
}) => {
  await openComparison(page, regionsPage, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  await paneFrame(desktop, "after")
    .contentFrame()
    .locator("#rg-rtl")
    .click({ position: { x: 200, y: 30 } });
  await page.keyboard.press("ArrowLeft");
  await expectRegionsAt(desktop, "#rg-rtl", [-40, -40], "x");
  await page.keyboard.press("ArrowLeft");
  await expectRegionsAt(desktop, "#rg-rtl", [-80, -80], "x");
  await page.keyboard.press("ArrowRight");
  await expectRegionsAt(desktop, "#rg-rtl", [-40, -40], "x");
});

test("smooth-scrolling panels still move together at once on both axes", async ({
  page,
}) => {
  await openComparison(page, regionsPage, "desktop", "Overlay");
  const smooth = "* { scroll-behavior: smooth !important; }";
  await page.addStyleTag({ content: smooth });
  const desktop = comparisonSection(page, "desktop");
  for (const side of ["before", "after"] as const)
    await paneFrame(desktop, side).evaluate((frame: HTMLIFrameElement, css) => {
      const style = frame.contentDocument!.createElement("style");
      style.textContent = css;
      frame.contentDocument!.head.append(style);
    }, smooth);
  // An instant script scroll of Current's grid, on both axes.
  await paneFrame(desktop, "after").evaluate((frame: HTMLIFrameElement) =>
    frame
      .contentDocument!.querySelector("#rg-grid")!
      .scrollTo({ left: 150, top: 90, behavior: "instant" }),
  );
  const read = async () => {
    const offsets = await regionOffsets(desktop, "#rg-grid");
    return `${offsets.before.x},${offsets.before.y}`;
  };
  const samples = await sampleFrames(page, read, 20);
  expect(
    samples.filter((sample) => sample !== "0,0" && sample !== "150,90"),
    "the lower version never animates towards the offset",
  ).toEqual([]);
  expect(samples.at(-1)).toBe("150,90");
});
