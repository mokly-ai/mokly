import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { evidenceFixture, presentation } from "./viewer_evidence_fixture.js";
const start = evidenceFixture();
for (const cross of [false, true]) {
  const name = cross ? "postMessage" : "same-origin";
  for (const evidence of ["empty", "pending", "unavailable"] as const) {
    test(`${name} ${evidence} evidence ends invalid pick once and allows restart`, async ({
      page,
    }) => {
      await start(page, cross);
      await page.evaluate(async (evidence) => {
        const probe = window.evidence;
        await probe.frames.startPick();
        probe.update("mobile", evidence);
      }, evidence);
      await expect
        .poll(() => page.evaluate(() => window.evidence.updates))
        .toBe(1);
      await presentation(page, cross, 0);
      expect(await page.evaluate(() => window.evidence.events)).toEqual([
        "start",
        "end:evidence",
      ]);
      await page.evaluate(async () => {
        const probe = window.evidence;
        probe.frames.cancelPick();
        probe.update("mobile");
        await probe.frames.startPick();
      });
      await presentation(page, cross, 2);
      expect(await page.evaluate(() => window.evidence.events)).toEqual([
        "start",
        "end:evidence",
        "start",
      ]);
      expect(await page.evaluate(() => window.evidence.mounts)).toBe(2);
    });
  }

  test(`${name} removed explicit target clears labels and permits picking`, async ({
    page,
  }) => {
    await start(page, cross);
    await page.evaluate(async () => {
      const probe = window.evidence;
      await probe.frames.highlight(probe.instance);
      probe.update("mobile", "empty");
    });
    await expect
      .poll(() => page.evaluate(() => window.evidence.updates))
      .toBe(1);
    await presentation(page, cross, 0);
    expect(await page.evaluate(() => window.evidence.events)).toEqual([]);
    await page.evaluate(async () => {
      window.evidence.update("mobile");
      await window.evidence.frames.startPick();
    });
    await presentation(page, cross, 2);
    expect(await page.evaluate(() => window.evidence.events)).toEqual([
      "start",
    ]);
  });

  test(`${name} one lost multi-highlight ref clears every frame and still ends a later pick`, async ({
    page,
  }) => {
    await start(page, cross);
    await page.evaluate(() =>
      window.evidence.frames.highlightInstances(window.evidence.instances),
    );
    await presentation(page, cross, 2);
    await page.evaluate(() => window.evidence.update("mobile", "empty"));
    await expect
      .poll(() => page.evaluate(() => window.evidence.updates))
      .toBe(1);
    await presentation(page, cross, 0);
    expect(await page.evaluate(() => window.evidence.events)).toEqual([]);
    await page.evaluate(async () => {
      window.evidence.update("mobile");
      await window.evidence.frames.startPick();
      window.evidence.update("desktop", "empty");
    });
    await expect
      .poll(() => page.evaluate(() => window.evidence.updates))
      .toBe(3);
    await presentation(page, cross, 0);
    expect(await page.evaluate(() => window.evidence.events)).toEqual([
      "start",
      "end:evidence",
    ]);
  });

  for (const hold of ["highlight", "list"] as const) {
    test(`${name} evidence cancels pending ${hold} activation without events`, async ({
      page,
    }) => {
      await start(page, cross);
      await page.evaluate((hold) => {
        const probe = window.evidence;
        probe.hold = hold;
        probe.geometryDuringHighlight = hold === "list";
        void probe.frames.startPick().then(
          () => {
            probe.outcome = "resolved";
          },
          (error: unknown) => {
            probe.outcome =
              error instanceof Error && "code" in error
                ? String(error.code)
                : "failed";
          },
        );
      }, hold);
      await page.waitForFunction(() => window.evidence.waiting);
      await page.evaluate(async (hold) => {
        if (hold === "list") {
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        }
        window.evidence.update("mobile");
      }, hold);
      await expect
        .poll(() => page.evaluate(() => window.evidence.outcome))
        .toBe("disposed");
      await presentation(page, cross, 0);
      expect(await page.evaluate(() => window.evidence.events)).toEqual([]);
      await page.evaluate(() => window.evidence.frames.startPick());
      await presentation(page, cross, 2);
      await page.evaluate(async () => {
        window.evidence.release();
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      });
      await presentation(page, cross, 2);
      expect(await page.evaluate(() => window.evidence.events)).toEqual([
        "start",
      ]);
    });
  }
}
