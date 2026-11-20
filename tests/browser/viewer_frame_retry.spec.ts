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

test("an inspection error keeps a frame, and a reported failure recovers with Try again", async ({
  page,
}) => {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(() => {
    const state = window as unknown as { mounts: number };
    state.mounts = 0;
    const mounted = new Set<HTMLIFrameElement>();
    let limited!: () => void;
    const limitDelivered = new Promise<void>((resolve) => {
      limited = resolve;
    });
    const host = window.viewerHarness.start("one");
    const adapter: FrameAdapter = {
      async mount(frame) {
        // On its first mount, the hidden desktop frame reports an inspection
        // limit. Then the shown mobile frame reports a session timeout, a
        // failure after load, so its line renders after the limit was handled.
        state.mounts++;
        const first = !mounted.has(frame);
        mounted.add(frame);
        const mobile = frame.dataset["workspaceFrame"] === "mobile";
        return {
          listInstanceBoundaries: async () => [],
          highlight: async () => {},
          scrollTo: async () => {},
          subscribe(listener) {
            if (first && mobile)
              void limitDelivered.then(() =>
                listener({ type: "error", code: "timeout" }),
              );
            else if (first)
              queueMicrotask(() => {
                listener({ type: "error", code: "limit" });
                limited();
              });
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
  const frames = page.locator("#one iframe");
  await expect(
    page.locator('#one iframe[data-workspace-frame="mobile"]'),
  ).toHaveAttribute("data-mokly-frame-state", "error");
  await expect(
    page.locator('#one iframe[data-workspace-frame="desktop"]'),
  ).toHaveAttribute("data-mokly-frame-state", "ready");
  await line.getByRole("button", { name: "Try again" }).click();
  await expect(line).toHaveCount(0);
  for (const frame of await frames.all())
    await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
  // Two frames mounted once each, and Try again mounted the failed one again.
  expect(
    await page.evaluate(() => (window as unknown as { mounts: number }).mounts),
  ).toBe(3);
});
