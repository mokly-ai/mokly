import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import {
  crossOriginFixture,
  mountCrossFrame,
  type FrameTestWindow,
} from "./frame_adapter_fixture.js";

test("cross-origin instance inspection works after a back-forward cache restore", async ({
  page,
}) => {
  const fixture = await crossOriginFixture();
  try {
    await mountCrossFrame(page, fixture);
    const frame = page.frameLocator("#frame");
    // Dispatch the cache lifecycle in each document's own window.
    await page.evaluate(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: true }),
      );
    });
    await frame.locator("body").evaluate(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: true }),
      );
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      );
    });
    await page.evaluate(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      );
    });

    const { boundaries, ready } = await page.evaluate(async () => {
      const state = window as unknown as FrameTestWindow;
      const boundaries = await state.mounted.listInstanceBoundaries();
      return {
        boundaries,
        ready: state.wire.filter(({ type }) => type === "ready"),
      };
    });
    const visible = fixture.usage.instances.find(({ id }) => id === "action")!;
    expect(ready).toHaveLength(2);
    expect(ready[1]).toEqual(ready[0]);
    expect(boundaries).toHaveLength(fixture.usage.instances.length);
    expect(
      boundaries.find(({ key }) => key === visible.key)!.ranges[0]!.boxes
        .length,
    ).toBeGreaterThan(0);
  } finally {
    await fixture.close();
  }
});
