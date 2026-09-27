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
  test(`${kind} reconnect replaces an unowned matching document while it is still loading`, async ({
    page,
  }) => {
    await page.goto(fixture.host.url);
    const path =
      kind === "current"
        ? "/static/screens/home.mobile.html"
        : fixture.temporaryPath;
    let requests = 0;
    let release = () => {};
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/held-reconnect.css", async (route) => {
      await released;
      await route.fulfill({ body: "", contentType: "text/css" });
    });
    await page.route(`${fixture.host.url}${path}`, async (route) => {
      requests++;
      if (requests !== 2) return route.continue();
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()).replace(
          "</head>",
          '<link rel="stylesheet" href="/held-reconnect.css"></head>',
        ),
      });
    });

    try {
      const result = await page.evaluate(
        async ({ kind, path }) => {
          const { sameOriginAdapter, temporaryPreviewAdapter } = (await import(
            `${location.origin}/__mokly/client/same_origin_adapter.js`
          )) as typeof LocalAdapter;
          const adapter =
            kind === "current"
              ? sameOriginAdapter()
              : temporaryPreviewAdapter();
          const frame = document.querySelector<HTMLIFrameElement>("#frame")!;
          frame.setAttribute("sandbox", "allow-same-origin");
          await new Promise<void>((resolve) => {
            frame.addEventListener("load", () => resolve(), { once: true });
            frame.src = path;
          });
          const view = {
            url: new URL(path, location.origin),
            usage: { status: "unavailable" as const },
          };
          const first = await adapter.mount(frame, view);
          const authenticated = frame.contentDocument;
          first.dispose();
          await new Promise<void>((resolve) => {
            const poll = setInterval(() => {
              if (
                frame.contentDocument !== authenticated &&
                frame.contentDocument?.readyState === "interactive"
              ) {
                clearInterval(poll);
                resolve();
              }
            }, 0);
            frame.contentWindow!.location.replace(view.url.href);
          });
          const unowned = frame.contentDocument;
          const mounted = await adapter.mount(frame, view);
          const replaced = frame.contentDocument !== unowned;
          mounted.dispose();
          return replaced;
        },
        { kind, path },
      );
      expect(result).toBe(true);
      expect(requests).toBe(3);
    } finally {
      release();
    }
  });

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
