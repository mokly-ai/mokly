import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { followupFixture } from "./viewer_followup_fixture.js";
import {
  releaseInspection,
  startInspection,
} from "./viewer_inspection_fixture.js";
import { startViewerPick } from "./viewer_pick.js";

/**
 * The frames on the canvas: the selection's one viewport, Mobile and after a
 * frame replacement Desktop, in both schemes.
 */
const SHOWN_FRAMES = 2;

let fixture: Awaited<ReturnType<typeof followupFixture>>;
test.beforeAll(async () => {
  fixture = await followupFixture();
});
test.afterAll(async () => fixture?.close());

/**
 * One case for each operation that a replaced pick started: a geometry read,
 * a label read, a highlight, and a scroll. A frame change replaces the pick in
 * two cases and `cancelPick()` in the other two, and each case lets the old
 * work fail or succeed late. The wrapper holds the old work after the real
 * adapter call, so the cases run on one adapter. Unit tests of
 * `InspectionWork`, the inspection controller, the geometry scheduler, and
 * `Picking` cover each operation with both late outcomes.
 */
const CASES = [
  { operation: "geometry", fail: true, replacement: "frame" },
  { operation: "labels", fail: false, replacement: "request" },
  { operation: "highlight", fail: false, replacement: "frame" },
  { operation: "scroll", fail: true, replacement: "request" },
] as const;

for (const { operation, fail, replacement } of CASES)
  test(`same-origin obsolete ${operation} ${fail ? "failure" : "success"} preserves ${replacement} replacement pick`, async ({
    page,
  }) => {
    await page.goto(fixture.host.url);
    await startInspection(page);
    await startViewerPick(page);
    await page.evaluate((operation) => {
      const host = window.viewerHarness.get("one");
      const probe = window.inspectionProbe;
      probe.hold =
        operation === "geometry" || operation === "labels" ? "list" : operation;
      if (operation === "geometry") probe.emit({ type: "geometry" });
      else {
        const pending =
          operation === "scroll"
            ? host.ref.current.scrollToInstance(probe.instance)
            : host.ref.current.highlightInstance(probe.instance);
        void pending.then(
          () => {
            probe.outcome = "resolved";
          },
          (error: unknown) => {
            probe.outcome =
              error instanceof Error && "code" in error
                ? String(error.code)
                : "uncoded rejection";
          },
        );
      }
    }, operation);
    await page.waitForFunction(() => window.inspectionProbe.waiting);
    await page.evaluate((replacement) => {
      const host = window.viewerHarness.get("one");
      if (replacement === "frame")
        host.ref.current.select({ viewport: "desktop" });
      else host.ref.current.cancelPick();
    }, replacement);
    await startViewerPick(page);
    // The pick labels the instance in each shown frame.
    const labels = page.locator("[data-mokly-label-layer] button");
    await expect(labels).toHaveCount(SHOWN_FRAMES);
    const label = await labels.first().elementHandle();
    if (operation !== "geometry")
      await expect
        .poll(() => page.evaluate(() => window.inspectionProbe.outcome))
        .toBe("disposed");
    await releaseInspection(page, fail);
    expect(
      await page.evaluate(() =>
        window.viewerHarness
          .get("one")
          .events.filter(
            (event) => event.name.startsWith("pick") || event.name === "error",
          ),
      ),
    ).toEqual([
      { name: "pick-start", value: null },
      {
        name: "pick-end",
        value: {
          reason: replacement === "frame" ? "navigation" : "cancelled",
        },
      },
      { name: "pick-start", value: null },
    ]);
    await expect(labels).toHaveCount(SHOWN_FRAMES);
    expect(await label!.evaluate((element) => element.isConnected)).toBe(true);
  });
