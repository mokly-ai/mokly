import { expect, test } from "@playwright/test";

import { followupFixture } from "./viewer_followup_fixture.js";
import {
  releaseInspection,
  startInspection,
} from "./viewer_inspection_fixture.js";

let fixture: Awaited<ReturnType<typeof followupFixture>>;
test.beforeAll(async () => {
  fixture = await followupFixture();
});
test.afterAll(async () => fixture?.close());

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
          await page.evaluate(async (operation) => {
            const host = window.viewerHarness.get("one");
            await host.ref.current.startPick();
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
          await page.evaluate(async (replacement) => {
            const host = window.viewerHarness.get("one");
            if (replacement === "frame")
              host.ref.current.select({ viewport: "desktop" });
            else host.ref.current.cancelPick();
            await host.ref.current.startPick();
          }, replacement);
          const labels = page.locator("[data-mokly-label-layer] button");
          await expect(labels).toHaveCount(1);
          const label = await labels.elementHandle();
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
          await expect(labels).toHaveCount(1);
          expect(await label!.evaluate((element) => element.isConnected)).toBe(
            true,
          );
        });
      }
    }
  }
}
