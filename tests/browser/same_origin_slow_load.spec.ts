import { setTimeout as delay } from "node:timers/promises";

import { expect, test } from "@playwright/test";

import type {
  FrameEvent,
  MountedFrame,
} from "../../packages/viewer/dist/client/frame_adapter.js";
import type * as LocalAdapter from "../../packages/viewer/dist/client/same_origin_adapter.js";

import { crossOriginFixture } from "./frame_adapter_fixture.js";
import {
  expectFrameLoaded,
  expectFramePath,
  expectFrameSource,
} from "./workspace_actions.js";

interface SlowLoadWindow extends Window {
  slowLoad: {
    abort: AbortController;
    events: FrameEvent[];
    mounted?: MountedFrame;
    outcome: string;
  };
}

let fixture: Awaited<ReturnType<typeof crossOriginFixture>>;
test.beforeAll(async () => {
  fixture = await crossOriginFixture();
});
test.afterAll(async () => {
  await fixture?.close();
});

for (const kind of ["current", "temporary"] as const) {
  for (const completion of ["load", "cancel", "timeout"] as const) {
    test(`${kind}: a slow local document preserves navigation until ${completion}`, async ({
      page,
    }) => {
      await page.goto(fixture.host.url);
      const source =
        kind === "current"
          ? "/static/home/index.mobile.html"
          : fixture.temporaryPath;
      let release = () => {};
      let requested = () => {};
      const held = new Promise<void>((resolve) => (release = resolve));
      const request = new Promise<void>((resolve) => (requested = resolve));
      await page.route("**/slow-mount.css", async (route) => {
        requested();
        await held;
        await route.fulfill({ body: "", contentType: "text/css" });
      });
      await page.route(`${fixture.host.url}${source}`, async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          body: (await response.text()).replace(
            "</head>",
            '<link rel="stylesheet" href="/slow-mount.css"></head>',
          ),
        });
      });
      try {
        await page.evaluate(
          async ({ kind, source }) => {
            const { sameOriginAdapter, temporaryPreviewAdapter } =
              (await import(
                `${location.origin}/__mokly/client/same_origin_adapter.js`
              )) as typeof LocalAdapter;
            const state = ((window as unknown as SlowLoadWindow).slowLoad = {
              abort: new AbortController(),
              events: [] as FrameEvent[],
              outcome: "pending",
            });
            const adapter =
              kind === "current"
                ? sameOriginAdapter()
                : temporaryPreviewAdapter();
            void adapter
              .mount(document.querySelector("#frame")!, {
                url: new URL(source, location.origin),
                usage: { status: "unavailable" },
                signal: state.abort.signal,
                onEvent: (event) => state.events.push(event),
              })
              .then(
                (mounted) => {
                  (window as unknown as SlowLoadWindow).slowLoad.mounted =
                    mounted;
                  state.outcome = "ready";
                },
                (error: { code: string }) => {
                  state.outcome = error.code;
                },
              );
          },
          { kind, source },
        );
        await request;
        const loaded =
          completion === "load"
            ? expectFrameLoaded(
                page.locator("#frame"),
                `${fixture.host.url}${source}`,
              ).then(
                () => true,
                () => false,
              )
            : undefined;
        const link = page.frameLocator("#frame").getByRole("link", {
          name: "Open Action",
        });
        await expect(link).toHaveCount(1);
        await delay(6_000);
        const outcome = () =>
          page.evaluate(
            () => (window as unknown as SlowLoadWindow).slowLoad.outcome,
          );
        await expect.poll(outcome).toBe("pending");
        await link.dispatchEvent("click");
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                (window as unknown as SlowLoadWindow).slowLoad.events.filter(
                  (event) => event.type === "navigation",
                ).length,
            ),
          )
          .toBe(1);
        if (completion === "cancel") {
          await page.evaluate(() =>
            (window as unknown as SlowLoadWindow).slowLoad.abort.abort(),
          );
        } else if (completion === "timeout") {
          await expect.poll(outcome, { timeout: 30_000 }).toBe("timeout");
        }
        release();
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                document.querySelector<HTMLIFrameElement>("#frame")!
                  .contentDocument?.readyState,
            ),
          )
          .toBe("complete");
        await expect
          .poll(outcome)
          .toBe(
            completion === "load"
              ? "ready"
              : completion === "cancel"
                ? "disposed"
                : "timeout",
          );
        await expect(page.locator("#frame")).toHaveAttribute(
          "sandbox",
          "allow-same-origin",
        );
        if (completion === "load") {
          expect(await loaded).toBe(true);
          await link.dispatchEvent("click");
          await expect
            .poll(() =>
              page.evaluate(
                () =>
                  (window as unknown as SlowLoadWindow).slowLoad.events.length,
              ),
            )
            .toBe(2);
        } else {
          await link.dispatchEvent("click");
          await expect
            .poll(() =>
              page.evaluate(
                () =>
                  document.querySelector<HTMLIFrameElement>("#frame")!
                    .contentWindow!.location.pathname,
              ),
            )
            .not.toBe(source);
          expect(
            await page.evaluate(
              () =>
                (window as unknown as SlowLoadWindow).slowLoad.events.length,
            ),
          ).toBe(1);
        }
      } finally {
        release();
        await page.evaluate(() => {
          const state = (window as unknown as SlowLoadWindow).slowLoad;
          state.abort.abort();
          state.mounted?.dispose();
        });
      }
    });
  }
}

test("frame load assertions wait for cold HTML within the document budget", async ({
  page,
}) => {
  await page.goto(fixture.host.url);
  const url = `${fixture.host.url}/static/slow.html`;
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(url, async (route) => {
    await held;
    await route.fulfill({
      body: "<!doctype html><p>Loaded</p>",
      contentType: "text/html",
    });
  });
  try {
    await page
      .locator("#frame")
      .evaluate((frame: HTMLIFrameElement, source) => {
        frame.src = source;
      }, url);
    const assertions = [
      expectFrameLoaded(page.locator("#frame"), url),
      expectFrameSource(page.locator("#frame"), url),
      expectFramePath(page, "#frame", /\/static\/slow\.html$/),
    ].map((assertion) =>
      assertion.then(
        () => true,
        () => false,
      ),
    );
    await delay(6_000);
    release();
    expect(await Promise.all(assertions)).toEqual([true, true, true]);
  } finally {
    release();
  }
});
