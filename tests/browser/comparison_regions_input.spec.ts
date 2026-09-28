import { expect, test, type Locator, type Page } from "@playwright/test";

import { comparisonRegionsFixture } from "../helpers/comparison_regions_fixture.js";

import {
  comparisonSection,
  documentExtent,
  expectStackAt,
  openComparison,
  paneFrame,
  sampleFrames,
} from "./comparison_alignment_helpers.js";
import {
  expectRegionsAt,
  expectRegionsTogether,
  regionOffsets,
  scrollRegion,
} from "./comparison_regions_helpers.js";

let fixture: Awaited<ReturnType<typeof comparisonRegionsFixture>>;
test.describe.configure({ timeout: 90_000 });
test.beforeAll(async () => {
  test.setTimeout(120_000);
  fixture = await comparisonRegionsFixture();
});
test.afterAll(async () => {
  await fixture?.close();
});

const shell = () => `${fixture.url}/view/screens/shell.html`;
const pageScreen = () => `${fixture.url}/view/screens/page.html`;

/** A region's vertical range in one version. */
function yRange(frame: Locator, selector: string): Promise<number> {
  return frame
    .contentFrame()
    .locator(selector)
    .evaluate((node) => node.scrollHeight - node.clientHeight);
}

/**
 * Press a key, then wait until both versions of a region agree on the
 * expected offset, or on any new offset when none is given.
 */
async function pressTogether(
  page: Page,
  section: Locator,
  key: string,
  selector: string,
  expected?: (from: number) => number,
): Promise<number> {
  const from = (await regionOffsets(section, selector)).after.y;
  await page.keyboard.press(key);
  let reached = from;
  await expect
    .poll(async () => {
      const offsets = await regionOffsets(section, selector);
      reached = offsets.after.y;
      if (offsets.before.y !== reached) return false;
      return expected ? reached === expected(from) : reached !== from;
    }, key)
    .toBe(true);
  return reached;
}

test("scroll keys after a click inside a panel scroll that panel in every version", async ({
  page,
}) => {
  await openComparison(page, shell(), "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  const top = paneFrame(desktop, "after");
  await top
    .contentFrame()
    .locator("#rg-lead")
    .click({ position: { x: 10, y: 100 } });
  const end = await yRange(top, ".rg-main");
  await pressTogether(page, desktop, "PageDown", ".rg-main");
  await pressTogether(page, desktop, "Space", ".rg-main");
  await pressTogether(page, desktop, "ArrowDown", ".rg-main", (at) => at + 40);
  await pressTogether(page, desktop, "ArrowUp", ".rg-main", (at) => at - 40);
  await pressTogether(page, desktop, "Shift+Space", ".rg-main");
  await pressTogether(page, desktop, "End", ".rg-main", () => end);
  await pressTogether(page, desktop, "PageUp", ".rg-main");
  await pressTogether(page, desktop, "Home", ".rg-main", () => 0);
  await expectStackAt(desktop, 0);
});

test("a focused panel keeps its keys until it ends, then the page moves", async ({
  page,
}) => {
  await openComparison(page, pageScreen(), "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  const top = paneFrame(desktop, "after");
  await top.contentFrame().locator("#rg-code").focus();
  await pressTogether(page, desktop, "PageDown", "#rg-code");
  const end = await yRange(top, "#rg-code");
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
  await openComparison(page, pageScreen(), "desktop", "Overlay");
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

test("focus moving into a panel scrolls every version's panel", async ({
  page,
}) => {
  await openComparison(page, shell(), "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  await paneFrame(desktop, "after").contentFrame().locator("#rg-focus").focus();
  await expectRegionsTogether(desktop, ".rg-main");
  await expectStackAt(desktop, 0);
});

test("an anchor inside a panel reveals it in every version, then the page", async ({
  page,
}) => {
  await openComparison(page, shell(), "desktop", "Overlay");
  const address = page.url();
  const desktop = comparisonSection(page, "desktop");
  const shown = (side: "after" | "before") =>
    paneFrame(desktop, side)
      .contentFrame()
      .locator("#rg-deep")
      .evaluate((target) => {
        const panel = target.closest(".rg-main")!;
        const top = panel.getBoundingClientRect().top + panel.clientTop;
        const rect = target.getBoundingClientRect();
        return rect.top >= top && rect.bottom <= top + panel.clientHeight;
      });
  await paneFrame(desktop, "after")
    .contentFrame()
    .getByRole("link", { name: "Jump to deep" })
    .click();
  await expectRegionsTogether(desktop, ".rg-main");
  expect([await shown("before"), await shown("after")]).toEqual([true, true]);
  await expectStackAt(desktop, 0);
  await expect(page).toHaveURL(address);
  await expect(page.locator("#mb-main h2")).toHaveText("Shell");

  await openComparison(page, pageScreen(), "desktop", "Side by side");
  const sides = comparisonSection(page, "desktop");
  const frame = paneFrame(sides, "before");
  await frame
    .contentFrame()
    .getByRole("link", { name: "Jump to code end" })
    .click();
  await expectRegionsTogether(sides, "#rg-code");
  await expect
    .poll(async () => {
      const top = await frame
        .contentFrame()
        .locator("#rg-code-end")
        .evaluate(
          (node) =>
            node.getBoundingClientRect().top +
            node.ownerDocument.scrollingElement!.scrollTop,
        );
      const viewports = await sides
        .locator("[data-comparison-viewport]")
        .evaluateAll((nodes) => nodes.map((node) => node.scrollTop));
      return viewports.length === 2 && viewports.every((y) => y === top);
    })
    .toBe(true);
});

test("a scroll the browser makes inside the lower version pulls every version along", async ({
  page,
}) => {
  await openComparison(page, shell(), "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  await scrollRegion(paneFrame(desktop, "before"), ".rg-main", { y: 500 });
  await expectRegionsAt(desktop, ".rg-main", [500, 500]);
});

test("smooth-scrolling panels still move together at once on both axes", async ({
  page,
}) => {
  await openComparison(page, pageScreen(), "desktop", "Overlay");
  const smooth = "* { scroll-behavior: smooth !important; }";
  await page.addStyleTag({ content: smooth });
  const desktop = comparisonSection(page, "desktop");
  for (const side of ["before", "after"] as const)
    await paneFrame(desktop, side)
      .contentFrame()
      .locator("head")
      .evaluate((head, rule) => {
        const style = head.ownerDocument.createElement("style");
        style.textContent = rule;
        head.append(style);
      }, smooth);
  await scrollRegion(paneFrame(desktop, "after"), "#rg-grid", {
    x: 150,
    y: 90,
  });
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

test("a touch drag over a panel moves every version's panel", async ({
  browser,
}) => {
  const context = await browser.newContext({ hasTouch: true });
  const page = await context.newPage();
  try {
    await openComparison(page, shell(), "desktop", "Overlay");
    const desktop = comparisonSection(page, "desktop");
    const box = (await paneFrame(desktop, "after")
      .contentFrame()
      .locator(".rg-main")
      .boundingBox())!;
    const client = await context.newCDPSession(page);
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + Math.min(box.height, 400) - 20);
    const touch = (
      type: "touchEnd" | "touchMove" | "touchStart",
      points: { x: number; y: number }[],
    ) => client.send("Input.dispatchTouchEvent", { type, touchPoints: points });
    await touch("touchStart", [{ x, y }]);
    for (let step = 1; step <= 10; step += 1)
      await touch("touchMove", [{ x, y: y - step * 25 }]);
    await touch("touchEnd", []);
    await expectRegionsTogether(desktop, ".rg-main");
    await expectStackAt(desktop, 0);
  } finally {
    await context.close();
  }
});
