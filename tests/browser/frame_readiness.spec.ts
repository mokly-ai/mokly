import { expect, test } from "@playwright/test";

import type { CatalogueUsage } from "../../packages/viewer/src/catalogue/types.js";
import type { MountedFrame } from "../../packages/viewer/src/client/frame_adapter.js";
import type * as PostAdapter from "../../packages/viewer/src/client/post_message_adapter.js";
import type * as LocalAdapter from "../../packages/viewer/src/client/same_origin_adapter.js";

import {
  crossOriginFixture,
  type FrameTestWindow,
} from "./frame_adapter_fixture.js";

interface ReadinessWindow extends FrameTestWindow {
  mounted: MountedFrame & { updateUsage(usage: CatalogueUsage): Promise<void> };
  measurements: number;
}

let fixture: Awaited<ReturnType<typeof crossOriginFixture>>;
test.beforeAll(async () => {
  fixture = await crossOriginFixture({
    body: '<action.Component label="Visible" /><MockLink to="action">Open Action</MockLink>',
  });
});
test.afterAll(async () => fixture?.close());

for (const cross of [false, true]) {
  for (const status of ["pending", "unavailable"] as const) {
    test(`${cross ? "postMessage" : "same-origin"} updates ${status} usage without reloading or measuring early`, async ({
      page,
    }) => {
      await page.goto(fixture.host.url);
      await page.evaluate(
        async ({ cross, status, origin }) => {
          const local = (await import(
            `${location.origin}/__mokly/client/same_origin_adapter.js`
          )) as typeof LocalAdapter;
          const remote = (await import(
            `${location.origin}/__mokly/client/post_message_adapter.js`
          )) as typeof PostAdapter;
          const adapter = cross
            ? remote.postMessageAdapter({ frameOrigin: origin })
            : local.sameOriginAdapter();
          const state = window as unknown as ReadinessWindow;
          state.frameEvents = [];
          state.mounted = (await adapter.mount(
            document.querySelector<HTMLIFrameElement>("#frame")!,
            {
              url: new URL(
                "/static/screens/home.mobile.html",
                cross ? origin : location.origin,
              ),
              usage: { status },
            },
          )) as ReadinessWindow["mounted"];
          state.unsubscribe = state.mounted.subscribe((event) =>
            state.frameEvents.push(event),
          );
        },
        { cross, status, origin: fixture.frames.url },
      );
      const frame = page.frameLocator("#frame");
      const body = await frame.locator("body").elementHandle();
      await frame.locator("body").evaluate(() => {
        const state = window as unknown as ReadinessWindow;
        state.measurements = 0;
        const read = Range.prototype.getClientRects;
        Range.prototype.getClientRects = function () {
          state.measurements++;
          return read.call(this);
        };
      });
      const button = frame.getByRole("button", {
        name: "Visible",
        exact: true,
      });
      await button.hover();
      await button.click();
      await frame.getByRole("link", { name: "Open Action" }).click();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as unknown as ReadinessWindow).frameEvents.filter(
                (event) => event.type === "navigation",
              ).length,
          ),
        )
        .toBe(1);
      expect(
        await page.evaluate(() =>
          (window as unknown as ReadinessWindow).frameEvents.filter((event) =>
            ["error", "hover", "click", "geometry"].includes(event.type),
          ),
        ),
      ).toEqual([]);
      expect(
        await body!.evaluate(
          () => (window as unknown as ReadinessWindow).measurements,
        ),
      ).toBe(0);
      await page.evaluate(
        async (json) => {
          const usage = JSON.parse(json) as CatalogueUsage;
          const state = window as unknown as ReadinessWindow;
          await state.mounted.updateUsage(usage);
          state.frameEvents.length = 0;
        },
        JSON.stringify({ status: "ready", ...fixture.usage }),
      );
      await button.hover();
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as unknown as ReadinessWindow).frameEvents.some(
              (event) => event.type === "hover" && event.key !== null,
            ),
          ),
        )
        .toBe(true);
      expect(
        await body!.evaluate((body) => body === window.document.body),
      ).toBe(true);
      expect(
        await body!.evaluate(
          () => (window as unknown as ReadinessWindow).measurements,
        ),
      ).toBeGreaterThan(0);
      await button.click();
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as unknown as ReadinessWindow).frameEvents.some(
              (event) => event.type === "click",
            ),
          ),
        )
        .toBe(true);
      await page.evaluate(
        async ({ key, status }) => {
          const state = window as unknown as ReadinessWindow;
          await state.mounted.scrollTo(key);
          await state.mounted.highlight([key], "pick");
          await state.mounted.updateUsage({ status });
          state.frameEvents.length = 0;
        },
        {
          key: fixture.usage.instances.find(
            (instance) => instance.id === "action",
          )!.key,
          status,
        },
      );
      await button.click();
      await frame.getByRole("link", { name: "Open Action" }).click();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as unknown as ReadinessWindow).frameEvents.filter(
                (event) => event.type === "navigation",
              ).length,
          ),
        )
        .toBe(1);
      expect(
        await page.evaluate(() =>
          (window as unknown as ReadinessWindow).frameEvents.filter(
            (event) => event.type !== "navigation",
          ),
        ),
      ).toEqual([]);
    });
  }
}
