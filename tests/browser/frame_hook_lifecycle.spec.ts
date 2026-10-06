import { expect, test } from "@playwright/test";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
});
test.afterAll(async () => fixture?.close());
test.beforeEach(async ({ page }) => {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.frameHookHarness));
});

test("StrictMode replay leaves exactly one active frame owner", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.frameHookHarness.start("strict-frame", { strict: true }),
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.frameHookHarness.snapshot("strict-frame")),
    )
    .toMatchObject({
      activeSubscriptions: 1,
      disposals: 1,
      mounts: 2,
      sessions: 1,
      status: "ready",
    });

  await page.evaluate(() => window.frameHookHarness.remove("strict-frame"));
  await expect
    .poll(() =>
      page.evaluate(() => window.frameHookHarness.snapshot("strict-frame")),
    )
    .toMatchObject({
      activeSubscriptions: 0,
      disposals: 2,
      mounts: 2,
      sessions: 0,
    });
});

test("a custom adapter that resolves after unmount is disposed", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.frameHookHarness.start("late-frame", { deferredMount: true }),
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.frameHookHarness.snapshot("late-frame")),
    )
    .toMatchObject({ mounts: 1, pendingMounts: 1, sessions: 1 });

  const readiness = await page.evaluate(async () => {
    const ready = window.frameHookHarness.ready("late-frame");
    window.frameHookHarness.remove("late-frame");
    window.frameHookHarness.resolveMount("late-frame");
    return ready;
  });
  expect(readiness).toBe("disposed");
  await expect
    .poll(() =>
      page.evaluate(() => window.frameHookHarness.snapshot("late-frame")),
    )
    .toMatchObject({ disposals: 1, pendingMounts: 0, sessions: 0 });
});

test("a custom adapter rejection reports an owned frame error", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.frameHookHarness.start("rejected-frame", { deferredMount: true }),
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.frameHookHarness.snapshot("rejected-frame")),
    )
    .toMatchObject({ mounts: 1, pendingMounts: 1, status: "loading" });

  await page.evaluate(() =>
    window.frameHookHarness.rejectMount("rejected-frame"),
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.frameHookHarness.snapshot("rejected-frame")),
    )
    .toMatchObject({ pendingMounts: 0, sessions: 1, status: "error" });
  expect(
    await page.evaluate(() => window.frameHookHarness.ready("rejected-frame")),
  ).toBe("rejected");
});

test("an adapter without updateUsage replaces its frame for new evidence", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.frameHookHarness.start("legacy-adapter", {
      supportsUsageUpdates: false,
    }),
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.frameHookHarness.snapshot("legacy-adapter")),
    )
    .toMatchObject({ mounts: 1, sessions: 1, status: "ready" });

  await page.evaluate(() =>
    window.frameHookHarness.renderUsage("legacy-adapter", "pending"),
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.frameHookHarness.snapshot("legacy-adapter")),
    )
    .toMatchObject({
      disposals: 1,
      mounts: 2,
      sessions: 1,
      status: "ready",
      updateStatuses: [],
      usageStatus: "pending",
    });
});

for (const kind of ["source", "identity"] as const) {
  test(`${kind} replacement transfers ownership to a new frame session`, async ({
    page,
  }) => {
    await page.evaluate(() => window.frameHookHarness.start("replacement"));
    await expect
      .poll(() =>
        page.evaluate(() => window.frameHookHarness.snapshot("replacement")),
      )
      .toMatchObject({ mounts: 1, sessions: 1, status: "ready" });

    await page.evaluate(
      (replacement) =>
        window.frameHookHarness.replaceDocument("replacement", replacement),
      kind,
    );
    await expect
      .poll(() =>
        page.evaluate(() => window.frameHookHarness.snapshot("replacement")),
      )
      .toMatchObject({
        activeSubscriptions: 1,
        disposals: 1,
        mounts: 2,
        sessions: 1,
        status: "ready",
        updateStatuses: [],
      });
  });
}

test("an unrelated preview rerender retains usage and highlights", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.frameHookHarness.start("preview-frame", { generatedUsage: true }),
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.frameHookHarness.snapshot("preview-frame")),
    )
    .toMatchObject({ sessions: 1, status: "ready", usageRevision: 0 });

  await page.evaluate(async () => {
    await window.frameHookHarness.highlight("preview-frame");
    window.frameHookHarness.rerender("preview-frame");
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.frameHookHarness.snapshot("preview-frame")),
    )
    .toMatchObject({
      highlightedKeys: ["instance"],
      updateStatuses: [],
      usageRevision: 0,
    });
});
