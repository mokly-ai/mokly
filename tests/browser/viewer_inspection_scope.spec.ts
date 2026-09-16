import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

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

async function masks(page: Page, cross: boolean, count: number) {
  if (cross) {
    const frames = page.locator("iframe[data-mokly-fragment-frame]");
    for (let i = 0; i < (await frames.count()); i++)
      await expect(
        frames.nth(i).contentFrame().locator("[data-mokly-overlay]"),
      ).toHaveCount(i === 0 ? count : 0);
  } else await expect(page.locator(".mbk-highlight-layer")).toHaveCount(count);
}

for (const cross of [false, true]) {
  for (const sibling of ["pending", "unavailable", "mounting"] as const) {
    test(`${cross ? "postMessage" : "same-origin"} scoped inspection excludes ${sibling} sibling with Both visible`, async ({
      page,
    }) => {
      await page.goto(fixture.host.url);
      await startInspection(page, cross, sibling);
      await page.evaluate(() => {
        const probe = window.inspectionProbe;
        void window.viewerHarness
          .get("one")
          .ref.current.highlightInstance(probe.instance)
          .then(
            () => {
              probe.outcome = "highlighted";
            },
            () => {
              probe.outcome = "rejected";
            },
          );
      });
      await expect
        .poll(() => page.evaluate(() => window.inspectionProbe.outcome))
        .toBe("highlighted");
      await expect(page.locator("[data-mokly-label-layer] button")).toHaveCount(
        1,
      );
      await masks(page, cross, 1);
      await page.evaluate(async () => {
        const probe = window.inspectionProbe;
        await window.viewerHarness
          .get("one")
          .ref.current.scrollToInstance(probe.instance);
        probe.emit({ type: "geometry" });
      });
      await releaseInspection(page, false);
      expect(
        await page.evaluate(() =>
          window.viewerHarness
            .get("one")
            .events.filter((event) => event.name === "error"),
        ),
      ).toEqual([]);
      expect(
        await page.evaluate(() =>
          window.inspectionProbe.calls.filter(
            (call) => call.viewport === "desktop" && call.operation !== "off",
          ),
        ),
      ).toEqual([]);
      await expect(page.locator("[data-mokly-label-layer] button")).toHaveCount(
        1,
      );
      await masks(page, cross, 1);

      await page.evaluate(() => {
        const probe = window.inspectionProbe;
        probe.hold = "list";
        probe.waiting = false;
        void window.viewerHarness
          .get("one")
          .ref.current.highlightInstance(probe.instance)
          .then(
            () => {
              probe.outcome = "unexpected success";
            },
            () => {
              probe.outcome = "rejected";
            },
          );
      });
      await page.waitForFunction(() => window.inspectionProbe.waiting);
      await releaseInspection(page, true);
      await expect
        .poll(() => page.evaluate(() => window.inspectionProbe.outcome))
        .toBe("rejected");
      await expect(page.locator("[data-mokly-label-layer] button")).toHaveCount(
        0,
      );
      await masks(page, cross, 0);
      expect(
        await page.evaluate(() =>
          window.viewerHarness
            .get("one")
            .events.filter((event) => event.name === "error"),
        ),
      ).toHaveLength(1);
    });
  }
}
