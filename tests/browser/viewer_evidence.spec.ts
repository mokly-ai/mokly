import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { evidenceFixture, presentation } from "./viewer_evidence_fixture.js";
const start = evidenceFixture();
for (const cross of [false, true]) {
  const name = cross ? "postMessage" : "same-origin";
  test(`${name} markers follow retained evidence in both directions`, async ({
    page,
  }) => {
    await start(page, cross);
    await page.evaluate(() =>
      window.evidence.setMarkers(window.evidence.instances),
    );
    await expect
      .poll(() => page.evaluate(() => window.evidence.markerStates))
      .toEqual([
        { id: "marker-0", status: "visible" },
        { id: "marker-1", status: "visible" },
      ]);
    await page.evaluate(() => window.evidence.update("mobile", "empty"));
    await expect
      .poll(() => page.evaluate(() => window.evidence.markerStates))
      .toEqual([
        { id: "marker-0", status: "unavailable" },
        { id: "marker-1", status: "visible" },
      ]);
    await page.evaluate(() => window.evidence.update("mobile"));
    await expect
      .poll(() => page.evaluate(() => window.evidence.markerStates))
      .toEqual([
        { id: "marker-0", status: "visible" },
        { id: "marker-1", status: "visible" },
      ]);
    expect(await page.evaluate(() => window.evidence.markerErrors)).toBe(0);
  });

  test(`${name} geometry during an asynchronous boundary list schedules a trailing marker read`, async ({
    page,
  }) => {
    await start(page, cross);
    const before = await page.evaluate(
      () =>
        window.evidence.calls.filter((call) => call === "mobile:list").length,
    );
    await page.evaluate(() => {
      window.evidence.geometryDuringList = true;
      window.evidence.setMarkers();
    });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.evidence.calls.filter((call) => call === "mobile:list")
              .length,
        ),
      )
      .toBeGreaterThanOrEqual(before + 2);
    await expect
      .poll(() => page.evaluate(() => window.evidence.markerStates))
      .toEqual([{ id: "marker-0", status: "visible" }]);
    expect(await page.evaluate(() => window.evidence.markerErrors)).toBe(0);
  });

  test(`${name} ready evidence restores active pick on retained frames`, async ({
    page,
  }) => {
    await start(page, cross);
    await page.evaluate(() => window.evidence.frames.startPick());
    await presentation(page, cross, 2);
    const body = await page
      .frameLocator('iframe[data-workspace-frame="mobile"]')
      .locator("body")
      .elementHandle();
    await page.evaluate(() => {
      window.evidence.update("mobile");
      window.evidence.update("desktop");
    });
    await expect
      .poll(() => page.evaluate(() => window.evidence.updates))
      .toBe(2);
    await presentation(page, cross, 2);
    expect(await body!.evaluate((element) => element === document.body)).toBe(
      true,
    );
    expect(await page.evaluate(() => window.evidence.mounts)).toBe(2);
    await page.evaluate(() => window.evidence.frames.startPick());
    expect(await page.evaluate(() => window.evidence.events)).toEqual([
      "start",
    ]);
    await page.locator("[data-mokly-label-layer] button").first().click();
    expect(await page.evaluate(() => window.evidence.events)).toEqual([
      "start",
      "click:mobile",
      "end:selected",
    ]);
    await page.evaluate(() => window.evidence.frames.startPick());
    await presentation(page, cross, 2);
  });

  for (const pending of [false, true]) {
    test(`${name} evidence restores scoped highlight with ${pending ? "pending" : "ready"} sibling`, async ({
      page,
    }) => {
      await start(page, cross, pending);
      await page.evaluate(async () => {
        const probe = window.evidence;
        await probe.frames.highlight(probe.instance);
        probe.calls.length = 0;
        probe.update("mobile");
      });
      await expect
        .poll(() => page.evaluate(() => window.evidence.updates))
        .toBe(1);
      await presentation(page, cross, 1);
      expect(
        await page.evaluate(() =>
          window.evidence.calls.filter(
            (call) => call.startsWith("desktop:") && call !== "desktop:off",
          ),
        ),
      ).toEqual([]);
      const label = await page
        .locator("[data-mokly-label-layer] button")
        .elementHandle();
      await page.evaluate(
        (pending) =>
          window.evidence.update("desktop", pending ? "pending" : "ready"),
        pending,
      );
      await expect
        .poll(() => page.evaluate(() => window.evidence.updates))
        .toBe(2);
      await presentation(page, cross, 1);
      expect(await label!.evaluate((element) => element.isConnected)).toBe(
        true,
      );
      expect(await page.evaluate(() => window.evidence.events)).toEqual([]);
    });
  }

  for (const hold of ["highlight", "list"] as const) {
    test(`${name} unrelated evidence preserves pending scoped ${hold}`, async ({
      page,
    }) => {
      await start(page, cross);
      await page.evaluate((hold) => {
        const probe = window.evidence;
        probe.calls.length = 0;
        probe.hold = hold;
        void probe.frames.highlight(probe.instance).then(
          () => {
            probe.outcome = "resolved";
          },
          () => {
            probe.outcome = "rejected";
          },
        );
      }, hold);
      await page.waitForFunction(() => window.evidence.waiting);
      await page.evaluate(async () => {
        window.evidence.update("desktop");
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      });
      await expect
        .poll(() => page.evaluate(() => window.evidence.updates))
        .toBe(1);
      expect(
        await page.evaluate(() => window.evidence.outcome),
      ).toBeUndefined();
      await page.evaluate(() => window.evidence.release());
      await expect
        .poll(() => page.evaluate(() => window.evidence.outcome))
        .toBe("resolved");
      await presentation(page, cross, 1);
      expect(
        await page.evaluate(
          () =>
            window.evidence.calls.filter((call) => call === "mobile:highlight")
              .length,
        ),
      ).toBe(1);
      expect(await page.evaluate(() => window.evidence.events)).toEqual([]);
    });
  }
}
