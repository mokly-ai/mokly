import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { evidenceFixture, presentation } from "./viewer_evidence_fixture.js";
import { startViewerPick } from "./viewer_pick.js";
import { awaitViewerWork } from "./viewer_work.js";
const start = evidenceFixture();
// The viewer adopts the evidence, and the wrapper holds the adapter calls
// after the real ones, so these cases run on one adapter. The adapters have
// their own specs, and frame_readiness.spec.ts updates usage on both.
// Each status that is not inspectable runs, because the pick reaches each
// one through the live viewer.
for (const evidence of ["empty", "pending", "unavailable"] as const) {
  test(`same-origin ${evidence} evidence ends invalid pick once and allows restart`, async ({
    page,
  }) => {
    await start(page);
    await awaitViewerWork(
      page,
      (evidence) =>
        window.holdViewerWork(
          (async () => {
            const probe = window.evidence;
            await probe.frames.startPick();
            probe.update("mobile", evidence);
          })(),
        ),
      evidence,
    );
    await expect
      .poll(() => page.evaluate(() => window.evidence.updates))
      .toBe(1);
    await presentation(page, 0);
    expect(await page.evaluate(() => window.evidence.events)).toEqual([
      "start",
      "end:evidence",
    ]);
    await awaitViewerWork(page, () =>
      window.holdViewerWork(
        (async () => {
          const probe = window.evidence;
          probe.frames.cancelPick();
          probe.update("mobile");
          await probe.frames.startPick();
        })(),
      ),
    );
    await presentation(page, 2);
    expect(await page.evaluate(() => window.evidence.events)).toEqual([
      "start",
      "end:evidence",
      "start",
    ]);
    expect(await page.evaluate(() => window.evidence.mounts)).toBe(2);
  });
}

test("same-origin removed explicit target clears labels and permits picking", async ({
  page,
}) => {
  await start(page);
  await awaitViewerWork(page, () =>
    window.holdViewerWork(
      (async () => {
        const probe = window.evidence;
        await probe.frames.highlight(probe.instance);
        probe.update("mobile", "empty");
      })(),
    ),
  );
  await expect.poll(() => page.evaluate(() => window.evidence.updates)).toBe(1);
  await presentation(page, 0);
  expect(await page.evaluate(() => window.evidence.events)).toEqual([]);
  await awaitViewerWork(page, () =>
    window.holdViewerWork(
      (async () => {
        window.evidence.update("mobile");
        await window.evidence.frames.startPick();
      })(),
    ),
  );
  await presentation(page, 2);
  expect(await page.evaluate(() => window.evidence.events)).toEqual(["start"]);
});

test("same-origin one lost multi-highlight ref clears every frame and still ends a later pick", async ({
  page,
}) => {
  await start(page);
  await awaitViewerWork(page, () =>
    window.holdViewerWork(
      window.evidence.frames.highlightInstances(window.evidence.instances),
    ),
  );
  await presentation(page, 2);
  await page.evaluate(() => window.evidence.update("mobile", "empty"));
  await expect.poll(() => page.evaluate(() => window.evidence.updates)).toBe(1);
  await presentation(page, 0);
  expect(await page.evaluate(() => window.evidence.events)).toEqual([]);
  await page.evaluate(() => window.evidence.update("mobile"));
  await startViewerPick(page, "evidence");
  await page.evaluate(() => window.evidence.update("desktop", "empty"));
  await expect.poll(() => page.evaluate(() => window.evidence.updates)).toBe(3);
  await presentation(page, 0);
  expect(await page.evaluate(() => window.evidence.events)).toEqual([
    "start",
    "end:evidence",
  ]);
});

for (const hold of ["highlight", "list"] as const) {
  test(`same-origin evidence cancels pending ${hold} activation without events`, async ({
    page,
  }) => {
    await start(page);
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
    await awaitViewerWork(
      page,
      (hold) =>
        window.holdViewerWork(
          (async () => {
            if (hold === "list") {
              await new Promise(requestAnimationFrame);
              await new Promise(requestAnimationFrame);
            }
            window.evidence.update("mobile");
          })(),
        ),
      hold,
    );
    await expect
      .poll(() => page.evaluate(() => window.evidence.outcome))
      .toBe("disposed");
    await presentation(page, 0);
    expect(await page.evaluate(() => window.evidence.events)).toEqual([]);
    await awaitViewerWork(page, () =>
      window.holdViewerWork(window.evidence.frames.startPick()),
    );
    await presentation(page, 2);
    await awaitViewerWork(page, () =>
      window.holdViewerWork(
        (async () => {
          window.evidence.release();
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        })(),
      ),
    );
    await presentation(page, 2);
    expect(await page.evaluate(() => window.evidence.events)).toEqual([
      "start",
    ]);
  });
}
