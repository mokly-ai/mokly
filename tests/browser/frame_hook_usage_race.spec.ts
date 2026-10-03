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

test("usage adopted while a mount finishes reaches the frame before it is ready", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.frameHookHarness.start("mount-race", { deferredMount: true }),
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.frameHookHarness.snapshot("mount-race")),
    )
    .toMatchObject({ mounts: 1, pendingMounts: 1, sessions: 1 });

  await page.evaluate(() => {
    window.frameHookHarness.renderUsageWhileMountFinishes(
      "mount-race",
      "pending",
    );
    window.frameHookHarness.resolveMount("mount-race");
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.frameHookHarness.snapshot("mount-race")),
    )
    .toMatchObject({ usageRevision: 1, usageStatus: "pending" });

  expect(
    await page.evaluate(() => window.frameHookHarness.ready("mount-race")),
  ).toBe("ready");
  expect(
    await page.evaluate(() => window.frameHookHarness.snapshot("mount-race")),
  ).toMatchObject({
    pendingMounts: 0,
    sessions: 1,
    status: "ready",
    updateStatuses: ["pending"],
    usageRevision: 1,
    usageStatus: "pending",
  });
});
