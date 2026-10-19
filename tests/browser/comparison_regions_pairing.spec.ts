/**
 * Region pairing on the copied comparison output, under the region pairing
 * contract. In the regions shell, a named horizontal timeline and the main
 * and Projects panels move together on both axes in Overlay and Difference.
 * Each pairing rule pairs its panel, while an ambiguous, an off, and a new
 * panel scroll alone. A component's scrolling list moves in every version.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import {
  comparisonSection,
  expectRegionsAt,
  expectStackAt,
  openComparison,
  paneFrame,
  regionOffset,
  regionOffsets,
  settleRegion,
  wheelOverRegion,
  type Offset,
} from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { modeButton } from "./comparison_ui.js";

const shell = comparisonPaths.regionsShell;
const still = { x: 0, y: 0 };
/** Notes changes its classes, so each version has its own selector. */
const NOTES = { before: ".rg-notes-old", after: ".rg-notes-new" } as const;

function notesOffsets(section: Locator): Promise<Offset[]> {
  return Promise.all(
    (["before", "after"] as const).map((side) =>
      regionOffset(paneFrame(section, side), NOTES[side]),
    ),
  );
}

/** Scroll one version's panel alone and wait until it rests there. */
async function scrollAlone(
  page: Page,
  frame: Locator,
  selector: string,
  delta: number,
) {
  const from = (await regionOffset(frame, selector)).y;
  await wheelOverRegion(page, frame, selector, delta);
  await settleRegion(page, frame, selector, from + delta);
}

test("Overlay and Difference move every version's panels together on both axes", async ({
  page,
}) => {
  await openComparison(page, shell, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  const top = paneFrame(desktop, "after");
  await wheelOverRegion(page, top, ".rg-strip", 0, 300);
  await expectRegionsAt(desktop, ".rg-strip", [300, 300], "x");
  await wheelOverRegion(page, top, ".rg-main", 400);
  await expectRegionsAt(desktop, ".rg-main", [400, 400]);
  await wheelOverRegion(page, top, ".rg-nav", 200);
  await expectRegionsAt(desktop, ".rg-nav", [200, 200]);
  await expectRegionsAt(desktop, ".rg-strip", [300, 300], "x");
  await expectStackAt(desktop, 0);

  await modeButton(page, "Difference").click();
  await expect(desktop.locator(".mb-panes")).toHaveAttribute(
    "data-compare-mode",
    "difference",
  );
  await wheelOverRegion(page, top, ".rg-main", 300);
  await expectRegionsAt(desktop, ".rg-main", [700, 700]);
  await expectStackAt(desktop, 0);
});

test("each pairing rule pairs its panel; ambiguous, off and new panels scroll alone", async ({
  page,
}) => {
  await openComparison(page, shell, "desktop", "Side by side");
  const desktop = comparisonSection(page, "desktop");
  const before = paneFrame(desktop, "before");
  const after = paneFrame(desktop, "after");

  // Authored name, id, landmark and label, changed classes, and text alone.
  await wheelOverRegion(page, after, ".rg-strip", 0, 250);
  await expectRegionsAt(desktop, ".rg-strip", [250, 250], "x");
  await wheelOverRegion(page, before, "#activity", 100);
  await expectRegionsAt(desktop, "#activity", [100, 100]);
  await wheelOverRegion(page, after, ".rg-nav", 160);
  await expectRegionsAt(desktop, ".rg-nav", [160, 160]);
  await wheelOverRegion(page, after, NOTES.after, 120);
  await expect
    .poll(async () => (await notesOffsets(desktop)).map((offset) => offset.y))
    .toEqual([120, 120]);
  await wheelOverRegion(page, before, ".rg-tips", 80);
  await expectRegionsAt(desktop, ".rg-tips", [80, 80]);

  // Two equally likely halves leave the whole Queue without a counterpart.
  await scrollAlone(page, before, ".rg-queue-whole", 90);
  for (const half of [".rg-queue-a", ".rg-queue-b"])
    expect(
      await regionOffset(after, half),
      `${half} has no unambiguous counterpart`,
    ).toEqual(still);

  // Current's Log is off: neither version's Log moves the other.
  await scrollAlone(page, after, ".rg-log", 70);
  expect(await regionOffset(before, ".rg-log"), "an off source").toEqual(still);
  await scrollAlone(page, before, ".rg-log", 50);
  expect(await regionOffset(after, ".rg-log"), "an off target").toEqual({
    x: 0,
    y: 70,
  });

  // A panel that only Current has moves nothing else.
  await scrollAlone(page, after, ".rg-fresh", 60);
  expect(await regionOffsets(desktop, ".rg-tips")).toEqual({
    before: { x: 0, y: 80 },
    after: { x: 0, y: 80 },
  });
  expect((await notesOffsets(desktop)).map((offset) => offset.y)).toEqual([
    120, 120,
  ]);
});

test("a component's scrolling list moves in every version", async ({
  page,
}) => {
  await openComparison(
    page,
    comparisonPaths.taskListVariant,
    "desktop",
    "Overlay",
  );
  const desktop = comparisonSection(page, "desktop");
  await expect(desktop.locator(".mb-component-frame")).toHaveCount(1);
  await wheelOverRegion(page, paneFrame(desktop, "after"), ".rg-tasks", 240);
  await expectRegionsAt(desktop, ".rg-tasks", [240, 240]);
  await modeButton(page, "Side by side").click();
  await expect(desktop.locator(".mb-component-frame")).toHaveCount(2);
  const from = (await regionOffsets(desktop, ".rg-tasks")).before.y;
  await wheelOverRegion(page, paneFrame(desktop, "before"), ".rg-tasks", 120);
  await expectRegionsAt(desktop, ".rg-tasks", [from + 120, from + 120]);
});
