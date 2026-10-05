import { expect, test, type Locator } from "@playwright/test";

import { comparisonRegionsFixture } from "../helpers/comparison_regions_fixture.js";

import {
  comparisonSection,
  expectStackAt,
  openComparison,
  paneFrame,
} from "./comparison_alignment_helpers.js";
import {
  collectPageErrors,
  expectRegionsAt,
  regionOffset,
  regionOffsets,
  settleRegion,
  wheelOverRegion,
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

const shell = () => `${fixture.url}/view/shell/`;
const still = { x: 0, y: 0 };

/** A region's vertical scroll range in one version. */
function range(section: Locator, side: "after" | "before", selector: string) {
  return paneFrame(section, side)
    .contentFrame()
    .locator(selector)
    .evaluate((node) => node.scrollHeight - node.clientHeight);
}

test("Overlay and Difference move every version's panels together", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await openComparison(page, shell(), "desktop", "Overlay");
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

  await page.getByRole("button", { name: "Difference", exact: true }).click();
  await expect(desktop.locator(".mb-panes")).toHaveAttribute(
    "data-compare-mode",
    "difference",
  );
  await wheelOverRegion(page, top, ".rg-main", 300);
  await expectRegionsAt(desktop, ".rg-main", [700, 700]);
  await expectStackAt(desktop, 0);
  expect(errors).toEqual([]);
});

test("Side by side mirrors panels both ways and a shorter panel stops at its end", async ({
  page,
}) => {
  await openComparison(page, shell(), "desktop", "Side by side");
  const desktop = comparisonSection(page, "desktop");
  const before = paneFrame(desktop, "before");
  const after = paneFrame(desktop, "after");
  await wheelOverRegion(page, before, ".rg-main", 500);
  await expectRegionsAt(desktop, ".rg-main", [500, 500]);
  await wheelOverRegion(page, after, ".rg-main", -200);
  await expectRegionsAt(desktop, ".rg-main", [300, 300]);
  const longer = await range(desktop, "before", ".rg-main");
  const shorter = await range(desktop, "after", ".rg-main");
  expect(shorter).toBeLessThan(longer - 300);
  await wheelOverRegion(page, before, ".rg-main", longer - 300);
  await expectRegionsAt(desktop, ".rg-main", [longer, shorter]);
  await expect(
    after.contentFrame().locator("#rg-block-7"),
    "the shorter panel's content is never moved or restyled",
  ).toHaveCSS("transform", "none");
});

test("each pairing rule pairs its panel; ambiguous, off and new panels scroll alone", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await openComparison(page, shell(), "desktop", "Side by side");
  const desktop = comparisonSection(page, "desktop");
  const before = paneFrame(desktop, "before");
  const after = paneFrame(desktop, "after");

  await wheelOverRegion(page, after, ".rg-strip", 0, 250);
  await expectRegionsAt(desktop, ".rg-strip", [250, 250], "x");
  await wheelOverRegion(page, before, "#activity", 100);
  await expectRegionsAt(desktop, "#activity", [100, 100]);
  await wheelOverRegion(page, after, ".rg-nav", 160);
  await expectRegionsAt(desktop, ".rg-nav", [160, 160]);
  const notes = { before: ".rg-notes-old", after: ".rg-notes-new" };
  await wheelOverRegion(page, after, notes.after, 120);
  await expectRegionsAt(desktop, notes, [120, 120]);
  await wheelOverRegion(page, before, ".rg-tips", 80);
  await expectRegionsAt(desktop, ".rg-tips", [80, 80]);

  await wheelOverRegion(page, before, ".rg-queue-whole", 90);
  await settleRegion(page, before, ".rg-queue-whole", { y: 90 });
  for (const half of [".rg-queue-a", ".rg-queue-b"])
    expect(
      await regionOffset(after, half),
      `${half} has no unambiguous counterpart`,
    ).toEqual(still);

  await wheelOverRegion(page, after, ".rg-log", 70);
  await settleRegion(page, after, ".rg-log", { y: 70 });
  expect(await regionOffset(before, ".rg-log"), "an off source").toEqual(still);
  await wheelOverRegion(page, before, ".rg-log", 50);
  await settleRegion(page, before, ".rg-log", { y: 50 });
  expect(await regionOffset(after, ".rg-log"), "an off target").toEqual({
    x: 0,
    y: 70,
  });

  await wheelOverRegion(page, after, ".rg-fresh", 60);
  await settleRegion(page, after, ".rg-fresh", { y: 60 });
  expect(await regionOffsets(desktop, ".rg-tips")).toEqual({
    before: { x: 0, y: 80 },
    after: { x: 0, y: 80 },
  });
  expect(await regionOffsets(desktop, notes)).toEqual({
    before: { x: 0, y: 120 },
    after: { x: 0, y: 120 },
  });
  expect(errors).toEqual([]);
});

test("both viewports keep their panels to their own section", async ({
  page,
}) => {
  await openComparison(page, shell(), "both", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  const mobile = comparisonSection(page, "mobile");
  await wheelOverRegion(page, paneFrame(desktop, "after"), ".rg-main", 300);
  await expectRegionsAt(desktop, ".rg-main", [300, 300]);
  await expectRegionsAt(mobile, ".rg-main", [0, 0]);
  await wheelOverRegion(page, paneFrame(mobile, "after"), ".rg-main", 200);
  await expectRegionsAt(mobile, ".rg-main", [200, 200]);
  await expectRegionsAt(desktop, ".rg-main", [300, 300]);
});

test("a component's scrolling list moves in every version", async ({
  page,
}) => {
  await openComparison(
    page,
    `${fixture.url}/view/tasks/list/`,
    "desktop",
    "Overlay",
  );
  const desktop = comparisonSection(page, "desktop");
  await expect(desktop.locator(".mb-component-frame")).toHaveCount(1);
  await wheelOverRegion(page, paneFrame(desktop, "after"), ".rg-tasks", 240);
  await expectRegionsAt(desktop, ".rg-tasks", [240, 240]);
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  await expect(desktop.locator(".mb-component-frame")).toHaveCount(2);
  await wheelOverRegion(page, paneFrame(desktop, "before"), ".rg-tasks", 120);
  await expectRegionsAt(desktop, ".rg-tasks", [120, 120]);
});
