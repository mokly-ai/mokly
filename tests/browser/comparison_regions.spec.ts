import { expect, type Page } from "@playwright/test";

import {
  comparisonSection,
  expectRegionsAt,
  expectRegionsAtRest,
  expectStackAt,
  openComparison,
  paneFrame,
  regionOffsets,
  regionRange,
  wheelOverRegion,
} from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { modeButton } from "./comparison_ui.js";

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

test("Overlay and Difference move every version's panels together", async ({
  page,
}) => {
  await openComparison(page, changed, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  const top = paneFrame(desktop, "after");
  await wheelOverRegion(page, top, panel, 200);
  await expectRegionsAt(desktop, panel, [200, 200]);
  await expectStackAt(desktop, 0);

  await modeButton(page, "Difference").click();
  await expect(desktop.locator(".mb-panes")).toHaveAttribute(
    "data-compare-mode",
    "difference",
  );
  await wheelOverRegion(page, top, panel, 100);
  await expectRegionsAt(desktop, panel, [300, 300]);
  await expectStackAt(desktop, 0);
});

test("Side by side mirrors panels both ways and a shorter panel stops at its end", async ({
  page,
}) => {
  await openComparison(page, changed, "desktop", "Side by side");
  const desktop = comparisonSection(page, "desktop");
  const before = paneFrame(desktop, "before");
  const after = paneFrame(desktop, "after");
  await wheelOverRegion(page, before, panel, 200);
  await expectRegionsAt(desktop, panel, [200, 200]);
  await wheelOverRegion(page, after, panel, -100);
  await expectRegionsAt(desktop, panel, [100, 100]);
  const shorter = await regionRange(before, panel);
  const longer = await regionRange(after, panel);
  expect(shorter).toBeLessThan(longer - 100);
  await wheelOverRegion(page, after, panel, longer - 100);
  await expectRegionsAt(desktop, panel, [shorter, longer]);
  await expect(
    before.contentFrame().locator("#panel-end"),
    "the shorter panel's content is never moved or restyled",
  ).toHaveCSS("transform", "none");
});

test("both viewports keep their panels to their own section", async ({
  page,
}) => {
  await openComparison(page, changed, "both", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  const mobile = comparisonSection(page, "mobile");
  await wheelOverRegion(page, paneFrame(desktop, "after"), panel, 200);
  await expectRegionsAt(desktop, panel, [200, 200]);
  await expectRegionsAt(mobile, panel, [0, 0]);
  await wheelOverRegion(page, paneFrame(mobile, "after"), panel, 100);
  await expectRegionsAt(mobile, panel, [100, 100]);
  await expectRegionsAt(desktop, panel, [200, 200]);
});

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
  await pressTogether(page, "ArrowDown", (at) => at + 40);
  await pressTogether(page, "ArrowUp", (at) => at - 40);
  await page.keyboard.press("End");
  const ends = [
    await regionRange(paneFrame(desktop, "before"), panel),
    await regionRange(top, panel),
  ] as [number, number];
  await expectRegionsAt(desktop, panel, ends);
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
  const desktop = comparisonSection(page, "desktop");
  const shown = (side: "after" | "before") =>
    paneFrame(desktop, side)
      .contentFrame()
      .locator("#panel-end")
      .evaluate((target) => {
        const box = target.closest("#panel")!;
        const top = box.getBoundingClientRect().top + box.clientTop;
        const rect = target.getBoundingClientRect();
        return rect.top >= top && rect.bottom <= top + box.clientHeight;
      });
  const after = paneFrame(desktop, "after").contentFrame();
  await after.getByRole("link", { name: "Panel link" }).click();
  await expectRegionsAtRest(desktop, panel, (offset) => offset !== 0);
  expect([await shown("before"), await shown("after")]).toEqual([true, true]);
  // The browser also brings the target to the top of the page.
  await expect
    .poll(async () => {
      const top = await after
        .locator("#panel-end")
        .evaluate(
          (node) =>
            node.getBoundingClientRect().top +
            node.ownerDocument.scrollingElement!.scrollTop,
        );
      const viewport = await desktop
        .locator("[data-comparison-viewport]")
        .evaluate((node) => node.scrollTop);
      return top > 0 && Math.abs(viewport - top) < 1;
    })
    .toBe(true);
  await expect(page).toHaveURL(address);
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
