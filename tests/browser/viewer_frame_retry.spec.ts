import { expect } from "@playwright/test";

import type { FrameAdapter } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
});
test.afterAll(async () => {
  await fixture?.close();
});

test("a frame that reports an error after its mount recovers with Try again", async ({
  page,
}) => {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(() => {
    const state = window as unknown as { mounts: number };
    state.mounts = 0;
    const host = window.viewerHarness.start("one");
    const adapter: FrameAdapter = {
      async mount() {
        const failing = ++state.mounts === 1;
        return {
          listInstanceBoundaries: async () => [],
          highlight: async () => {},
          scrollTo: async () => {},
          subscribe(listener) {
            // The first document reports a failure once it is mounted.
            if (failing)
              queueMicrotask(() =>
                listener({ type: "error", code: "unavailable" }),
              );
            return () => {};
          },
          dispose() {},
        };
      },
    };
    host.props.frameAdapter = adapter;
    host.render();
  });
  const line = page
    .locator("#one")
    .getByRole("status")
    .filter({ hasText: "This preview could not be loaded." });
  await expect(line).toHaveCount(1);
  await line.getByRole("button", { name: "Try again" }).click();
  await expect(line).toHaveCount(0);
  for (const frame of await page.locator("#one iframe").all())
    await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
  // Two frames mounted once each, and Try again mounted the failed one again.
  expect(
    await page.evaluate(() => (window as unknown as { mounts: number }).mounts),
  ).toBe(3);
});
