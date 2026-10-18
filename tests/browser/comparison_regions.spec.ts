import { expect } from "@playwright/test";

import {
  comparisonSection,
  expectRegionsAt,
  expectStackAt,
  openComparison,
  paneFrame,
  regionRange,
  wheelOverRegion,
} from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { modeButton } from "./comparison_ui.js";

const changed = comparisonPaths.changed;
const panel = "#panel";

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
