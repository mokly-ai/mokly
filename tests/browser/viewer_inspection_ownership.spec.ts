import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { followupFixture } from "./viewer_followup_fixture.js";
import {
  releaseInspection,
  startInspection,
} from "./viewer_inspection_fixture.js";
import { startViewerPick } from "./viewer_pick.js";
import { canvasFrame } from "./workspace_actions.js";

/** The frames of one viewport on the canvas: its Light and Dark frames. */
const SHOWN_FRAMES = 2;

let fixture: Awaited<ReturnType<typeof followupFixture>>;
test.beforeAll(async () => {
  fixture = await followupFixture();
});
test.afterAll(async () => fixture?.close());

/** Let any geometry read the viewer has scheduled start. */
const twoFrames = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

/**
 * The holds below are only meaningful when the test decides every geometry
 * read. A preview reports geometry after its own layout, scroll, font and DOM
 * changes; if one of those reports reached the viewer, its extra read could
 * take the hold meant for the operation under test.
 */
for (const cross of [false, true]) {
  test(`${cross ? "postMessage" : "same-origin"} preview geometry reaches the viewer only when the test emits it`, async ({
    page,
  }) => {
    await page.goto(fixture.host.url);
    await startInspection(page, cross);
    await page.evaluate(() =>
      window.viewerHarness.get("one").ref.current.startPick(),
    );
    await page.evaluate(twoFrames);
    const reads = () =>
      page.evaluate(
        () =>
          window.inspectionProbe.calls.filter(
            (call) => call.viewport === "mobile" && call.operation === "list",
          ).length,
      );
    const withheld = () =>
      page.evaluate(() => window.inspectionProbe.withheldGeometry);
    const before = { reads: await reads(), withheld: await withheld() };

    await page
      .locator(canvasFrame("mobile"))
      .contentFrame()
      .locator("body")
      .evaluate((body) => body.append(body.ownerDocument.createElement("div")));
    await expect.poll(withheld).toBeGreaterThan(before.withheld);
    await page.evaluate(twoFrames);
    expect(await reads()).toBe(before.reads);

    await page.evaluate(() =>
      window.inspectionProbe.emit({ type: "geometry" }),
    );
    await expect.poll(reads).toBeGreaterThan(before.reads);
  });
}

for (const cross of [false, true]) {
  for (const replacement of ["frame", "request"] as const) {
    for (const operation of [
      "geometry",
      "labels",
      "highlight",
      "scroll",
    ] as const) {
      for (const fail of [true, false]) {
        test(`${cross ? "postMessage" : "same-origin"} obsolete ${operation} ${fail ? "failure" : "success"} preserves ${replacement} replacement pick`, async ({
          page,
        }) => {
          await page.goto(fixture.host.url);
          await startInspection(page, cross);
          await startViewerPick(page);
          await page.evaluate((operation) => {
            const host = window.viewerHarness.get("one");
            const probe = window.inspectionProbe;
            probe.hold =
              operation === "geometry" || operation === "labels"
                ? "list"
                : operation;
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
          // The pick labels the instance in each shown frame: on the canvas,
          // the chosen viewport's Light and Dark frames.
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
                  (event) =>
                    event.name.startsWith("pick") || event.name === "error",
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
          expect(await label!.evaluate((element) => element.isConnected)).toBe(
            true,
          );
        });
      }
    }
  }
}
