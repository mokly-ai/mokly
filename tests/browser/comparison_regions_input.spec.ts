import { expect, type Locator, type Page } from "@playwright/test";

import {
  comparisonSection,
  expectRegionsAt,
  expectRegionsAtRest,
  expectStackAt,
  openComparison,
  paneFrame,
  regionOffsets,
  regionRange,
} from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";

const changed = comparisonPaths.changed;
const panel = "#panel";

/**
 * Press a key from the panel's resting offset, then wait until both versions
 * rest at the expected offset, or at any new offset when none is given.
 */
async function pressTogether(
  page: Page,
  key: string,
  expected?: (from: number) => number,
): Promise<number> {
  const desktop = comparisonSection(page, "desktop");
  const from = await expectRegionsAtRest(desktop, panel, () => true);
  await page.keyboard.press(key);
  return expectRegionsAtRest(
    desktop,
    panel,
    (offset) => (expected ? offset === expected(from) : offset !== from),
    key,
  );
}

/** Whether the panel's end target is inside its panel's visible box. */
function shownInPanel(frame: Locator): Promise<boolean> {
  return frame
    .contentFrame()
    .locator("#panel-end")
    .evaluate((target) => {
      const box = target.closest("#panel")!;
      const top = box.getBoundingClientRect().top + box.clientTop;
      const rect = target.getBoundingClientRect();
      return rect.top >= top && rect.bottom <= top + box.clientHeight;
    });
}

/** Expect every page viewport of a section at the target's page offset. */
async function expectPageAtTarget(
  section: Locator,
  frame: Locator,
): Promise<void> {
  await expect
    .poll(async () => {
      const top = await frame
        .contentFrame()
        .locator("#panel-end")
        .evaluate(
          (node) =>
            node.getBoundingClientRect().top +
            node.ownerDocument.scrollingElement!.scrollTop,
        );
      const viewports = await section
        .locator("[data-comparison-viewport]")
        .evaluateAll((nodes) => nodes.map((node) => node.scrollTop));
      return (
        top > 0 &&
        viewports.length > 0 &&
        viewports.every((y) => Math.abs(y - top) < 1)
      );
    })
    .toBe(true);
}

test("scroll keys after a click inside a panel scroll that panel in every version", async ({
  page,
}) => {
  await openComparison(page, changed, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  const top = paneFrame(desktop, "after");
  await top
    .contentFrame()
    .locator(panel)
    .click({ position: { x: 10, y: 10 } });
  await pressTogether(page, "PageDown");
  await pressTogether(page, "Space");
  await pressTogether(page, "ArrowDown", (at) => at + 40);
  await pressTogether(page, "ArrowUp", (at) => at - 40);
  await pressTogether(page, "Shift+Space");
  // The panels differ in height, so each one stops at its own end.
  const shorter = await regionRange(paneFrame(desktop, "before"), panel);
  const longer = await regionRange(top, panel);
  await page.keyboard.press("End");
  await expectRegionsAt(desktop, panel, [shorter, longer]);
  await page.keyboard.press("PageUp");
  await expect
    .poll(async () => {
      const { after, before } = await regionOffsets(desktop, panel);
      return after.y < longer && before.y === Math.min(after.y, shorter);
    })
    .toBe(true);
  await page.keyboard.press("Home");
  await expectRegionsAt(desktop, panel, [0, 0]);
  await expectStackAt(desktop, 0);
});

test("focus moving into a panel scrolls every version's panel", async ({
  page,
}) => {
  await openComparison(page, changed, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  await paneFrame(desktop, "after")
    .contentFrame()
    .locator("#panel-link")
    .focus();
  await expectRegionsAtRest(desktop, panel, (offset) => offset !== 0);
  await expectStackAt(desktop, 0);
});

test("an anchor inside a panel reveals it in every version, then the page", async ({
  page,
}) => {
  await openComparison(page, changed, "desktop", "Overlay");
  const address = page.url();
  const stack = comparisonSection(page, "desktop");
  const top = paneFrame(stack, "after");
  await top.contentFrame().getByRole("link", { name: "Panel link" }).click();
  await expectRegionsAtRest(stack, panel, (offset) => offset !== 0);
  expect([
    await shownInPanel(paneFrame(stack, "before")),
    await shownInPanel(top),
  ]).toEqual([true, true]);
  // The browser also brings the target to the top of the page.
  await expectPageAtTarget(stack, top);
  await expect(page).toHaveURL(address);
  await expect(page.locator("#mb-main h2").first()).toHaveText(
    "Changed screen",
  );

  // Side by side: the anchor in the Before version moves both panes.
  await openComparison(page, changed, "desktop", "Side by side");
  const sides = comparisonSection(page, "desktop");
  const before = paneFrame(sides, "before");
  await before.contentFrame().getByRole("link", { name: "Panel link" }).click();
  await expectRegionsAtRest(sides, panel, (offset) => offset !== 0);
  expect(await shownInPanel(before)).toBe(true);
  await expectPageAtTarget(sides, before);
  await expect(page.locator("#mb-main h2").first()).toHaveText(
    "Changed screen",
  );
});

test("a scroll the browser makes inside the lower version pulls every version along", async ({
  page,
}) => {
  await openComparison(page, changed, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  await paneFrame(desktop, "before").evaluate((frame: HTMLIFrameElement) =>
    frame.contentDocument!.querySelector("#panel")!.scrollTo({
      behavior: "instant",
      top: 200,
    }),
  );
  await expectRegionsAt(desktop, panel, [200, 200]);
  expect((await regionOffsets(desktop, panel)).after.x).toBe(0);
});

test.describe("touch input", () => {
  test.use({ hasTouch: true });

  test("a touch drag over a panel moves every version's panel", async ({
    page,
  }) => {
    await openComparison(page, changed, "desktop", "Overlay");
    const desktop = comparisonSection(page, "desktop");
    const box = await paneFrame(desktop, "after")
      .contentFrame()
      .locator(panel)
      .boundingBox();
    expect(box).not.toBeNull();
    const client = await page.context().newCDPSession(page);
    const x = Math.round(box!.x + box!.width / 2);
    const y = Math.round(box!.y + box!.height - 20);
    const touch = (
      type: "touchEnd" | "touchMove" | "touchStart",
      points: { x: number; y: number }[],
    ) => client.send("Input.dispatchTouchEvent", { type, touchPoints: points });
    await touch("touchStart", [{ x, y }]);
    for (let step = 1; step <= 10; step += 1)
      await touch("touchMove", [{ x, y: y - step * 10 }]);
    await touch("touchEnd", []);
    // Both versions' panels rest together past the top; the page stays.
    await expectRegionsAtRest(desktop, panel, (offset) => offset > 0);
    await expectStackAt(desktop, 0);
  });
});
