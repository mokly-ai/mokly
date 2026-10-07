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
      const readiness = page.evaluate(() => {
        const readiness = window.frameHookHarness.ready("superseded");
        window.frameHookHarness.renderUsage(
          "superseded",
          "unavailable",
          "second",
        );
        return readiness;
      });
      if (reuse) {
        await page.waitForFunction(
          () =>
            window.frameHookHarness.snapshot("superseded").usageRevision >= 2,
          undefined,
          { timeout: 15_000, polling: "raf" },
        );
        await page.evaluate(() =>
          window.frameHookHarness.renderUsage("superseded", "pending", "first"),
        );
      }
      const obsolete = await readiness;
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
      return ready;
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
