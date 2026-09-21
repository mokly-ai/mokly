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

for (const reject of [false, true]) {
  for (const reuse of [false, true]) {
    test(`superseded evidence fences late ${reject ? "failure" : "success"}${reuse ? " with a reused snapshot" : ""}`, async ({
      page,
    }) => {
      await page.evaluate(() =>
        window.frameHookHarness.start("superseded", {
          deferredUpdates: true,
        }),
      );
      await expect
        .poll(() =>
          page.evaluate(() => window.frameHookHarness.snapshot("superseded")),
        )
        .toMatchObject({ sessions: 1, status: "ready" });

      await page.evaluate(() =>
        window.frameHookHarness.renderUsage("superseded", "pending", "first"),
      );
      await expect
        .poll(() =>
          page.evaluate(() => window.frameHookHarness.snapshot("superseded")),
        )
        .toMatchObject({ pendingUpdates: 1, updateStatuses: ["pending"] });
      const obsolete = await page.evaluate(async (reuseSnapshot) => {
        const readiness = window.frameHookHarness.ready("superseded");
        window.frameHookHarness.renderUsage(
          "superseded",
          "unavailable",
          "second",
        );
        if (reuseSnapshot) {
          while (
            window.frameHookHarness.snapshot("superseded").usageRevision < 2
          )
            await new Promise(requestAnimationFrame);
          window.frameHookHarness.renderUsage("superseded", "pending", "first");
        }
        return readiness;
      }, reuse);
      expect(obsolete).toBe("disposed");

      await page.evaluate((fail) => {
        if (fail) window.frameHookHarness.rejectUpdate("superseded");
        else window.frameHookHarness.resolveUpdate("superseded");
      }, reject);
      const statuses = reuse
        ? ["pending", "pending"]
        : ["pending", "unavailable"];
      await expect
        .poll(() =>
          page.evaluate(() => window.frameHookHarness.snapshot("superseded")),
        )
        .toMatchObject({
          pendingUpdates: 1,
          status: "ready",
          updateStatuses: statuses,
          usageRevision: reuse ? 3 : 2,
          usageStatus: reuse ? "pending" : "unavailable",
        });
      await page.evaluate(() =>
        window.frameHookHarness.resolveUpdate("superseded"),
      );
      await expect
        .poll(() =>
          page.evaluate(() => window.frameHookHarness.snapshot("superseded")),
        )
        .toMatchObject({ pendingUpdates: 0, sessions: 1, status: "ready" });
      expect(
        await page.evaluate(() => window.frameHookHarness.ready("superseded")),
      ).toBe("ready");
    });
  }
}

for (const reject of [false, true]) {
  test(`unmount fences a pending usage ${reject ? "failure" : "success"}`, async ({
    page,
  }) => {
    await page.evaluate(() =>
      window.frameHookHarness.start("disposed-update", {
        deferredUpdates: true,
      }),
    );
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.frameHookHarness.snapshot("disposed-update"),
        ),
      )
      .toMatchObject({ sessions: 1, status: "ready" });

    await page.evaluate(() =>
      window.frameHookHarness.renderUsage("disposed-update", "pending"),
    );
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.frameHookHarness.snapshot("disposed-update"),
        ),
      )
      .toMatchObject({ pendingUpdates: 1 });
    const readiness = await page.evaluate(async () => {
      const ready = window.frameHookHarness.ready("disposed-update");
      window.frameHookHarness.remove("disposed-update");
      return Promise.race([
        ready,
        new Promise<string>((resolve) =>
          setTimeout(() => resolve("still pending"), 50),
        ),
      ]);
    });
    await page.evaluate((fail) => {
      if (fail) window.frameHookHarness.rejectUpdate("disposed-update");
      else window.frameHookHarness.resolveUpdate("disposed-update");
    }, reject);

    expect(readiness).toBe("disposed");
    expect(
      await page.evaluate(() =>
        window.frameHookHarness.snapshot("disposed-update"),
      ),
    ).toMatchObject({ disposals: 1, pendingUpdates: 0, sessions: 0 });
  });
}

test("a later evidence update retries a current update failure", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.frameHookHarness.start("retry", { deferredUpdates: true }),
  );
  await expect
    .poll(() => page.evaluate(() => window.frameHookHarness.snapshot("retry")))
    .toMatchObject({ sessions: 1, status: "ready" });

  await page.evaluate(() =>
    window.frameHookHarness.renderUsage("retry", "pending"),
  );
  await expect
    .poll(() => page.evaluate(() => window.frameHookHarness.snapshot("retry")))
    .toMatchObject({ pendingUpdates: 1, updateStatuses: ["pending"] });
  await page.evaluate(() => window.frameHookHarness.rejectUpdate("retry"));
  await expect
    .poll(() => page.evaluate(() => window.frameHookHarness.snapshot("retry")))
    .toMatchObject({ pendingUpdates: 0, status: "error" });
  expect(
    await page.evaluate(() => window.frameHookHarness.ready("retry")),
  ).toBe("rejected");

  await page.evaluate(() =>
    window.frameHookHarness.renderUsage("retry", "unavailable"),
  );
  await expect
    .poll(() => page.evaluate(() => window.frameHookHarness.snapshot("retry")))
    .toMatchObject({
      pendingUpdates: 1,
      updateStatuses: ["pending", "unavailable"],
    });
  await page.evaluate(() => window.frameHookHarness.resolveUpdate("retry"));
  await expect
    .poll(() => page.evaluate(() => window.frameHookHarness.snapshot("retry")))
    .toMatchObject({ pendingUpdates: 0, status: "ready" });
  expect(
    await page.evaluate(() => window.frameHookHarness.ready("retry")),
  ).toBe("ready");
});

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
