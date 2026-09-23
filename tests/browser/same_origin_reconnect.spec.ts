import { expect, test } from "@playwright/test";

import type * as LocalAdapter from "../../packages/viewer/dist/client/same_origin_adapter.js";
import type { ComponentViewRecord } from "../../packages/viewer/dist/components/manifest_types.js";

import {
  crossOriginFixture,
  type FrameTestWindow,
} from "./frame_adapter_fixture.js";

let fixture: Awaited<ReturnType<typeof crossOriginFixture>>;
test.beforeAll(async () => {
  fixture = await crossOriginFixture();
});
test.afterAll(async () => {
  await fixture?.close();
});

for (const kind of ["current", "temporary"] as const) {
  test(`${kind} reconnect replaces an unowned document even when its URL and src match`, async ({
    page,
  }) => {
    await page.goto(fixture.host.url);
    const result = await page.evaluate(
      async ({ kind, path, usageJson }) => {
        const usage = JSON.parse(usageJson) as ComponentViewRecord;
        const { sameOriginAdapter, temporaryPreviewAdapter } = (await import(
          `${location.origin}/__mokly/client/same_origin_adapter.js`
        )) as typeof LocalAdapter;
        const adapter =
          kind === "current" ? sameOriginAdapter() : temporaryPreviewAdapter();
        const frame = document.querySelector<HTMLIFrameElement>("#frame")!;
        frame.setAttribute("sandbox", "allow-same-origin");
        const load = new Promise<void>((resolve) =>
          frame.addEventListener("load", () => resolve(), { once: true }),
        );
        frame.src = path;
        await load;
        const view = {
          url: new URL(path, location.origin),
          usage: { status: "ready" as const, ...usage },
        };
        const first = await adapter.mount(frame, view);
        const authenticated = frame.contentDocument;
        first.dispose();
        const reused = await adapter.mount(frame, view);
        const retained = frame.contentDocument === authenticated;
        reused.dispose();
        await new Promise<void>((resolve) => {
          frame.addEventListener("load", () => resolve(), { once: true });
          frame.contentWindow!.location.replace(view.url.href);
        });
        const unowned = frame.contentDocument;
        const state = window as unknown as FrameTestWindow;
        state.frameEvents = [];
        state.mounted = await adapter.mount(frame, {
          ...view,
          onEvent: (event) => state.frameEvents.push(event),
        });
        return {
          retained,
          replaced: frame.contentDocument !== unowned,
          boundaries: (await state.mounted.listInstanceBoundaries()).length,
        };
      },
      {
        kind,
        path:
          kind === "current"
            ? "/static/screens/home.mobile.html"
            : fixture.temporaryPath,
        usageJson: JSON.stringify(fixture.usage),
      },
    );
    expect(result).toEqual({
      retained: true,
      replaced: true,
      boundaries: fixture.usage.instances.length,
    });
    await page
      .frameLocator("#frame")
      .getByRole("link", { name: "Open Action" })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as unknown as FrameTestWindow).frameEvents.some(
            (event) => event.type === "navigation",
          ),
        ),
      )
      .toBe(true);
    await page.evaluate(() =>
      (window as unknown as FrameTestWindow).mounted.dispose(),
    );
  });
}
