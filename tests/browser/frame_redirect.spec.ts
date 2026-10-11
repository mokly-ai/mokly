import { expect, test } from "@playwright/test";

import type { InstanceRef } from "@mokly/viewer";

import type * as LocalAdapter from "../../packages/viewer/dist/client/same_origin_adapter.js";
import type { ComponentViewRecord } from "../../packages/viewer/dist/components/manifest_types.js";

import type { FrameTestWindow } from "./frame_adapter_fixture.js";
import { frameRedirectFixture } from "./frame_redirect_fixture.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof frameRedirectFixture>>;
test.beforeAll(async () => {
  fixture = await frameRedirectFixture();
});
test.afterAll(async () => {
  await fixture?.close();
});

for (const encoded of [false, true]) {
  test(`redirected static screens retain real highlight and pick (encoded=${encoded})`, async ({
    page,
  }) => {
    const firstRequest = fixture.redirected.requests.length;
    await page.goto(fixture.redirected.url);
    await page.waitForFunction(() => Boolean(window.viewerHarness));
    await page.evaluate((encoded) => {
      const host = window.viewerHarness.start("one", {
        defaultSelection: { screenPath: "home", viewport: "both" },
      });
      if (encoded) {
        const adapter = host.props.frameAdapter!;
        host.props.frameAdapter = {
          mount(frame, view) {
            const url = new URL(view.url);
            url.pathname = url.pathname.replace("/home/", "/%68ome/");
            url.search = "?revision=2";
            url.hash = "#position";
            return adapter.mount(frame, { ...view, url });
          },
        };
        host.render();
      }
    }, encoded);
    await page.waitForFunction(() =>
      Boolean(window.viewerHarness.get("one").ref.current),
    );
    const refs = fixture.catalogue.screens
      .find(({ path }) => path === "home")!
      .views.map((view): InstanceRef => {
        if (view.usage.status !== "ready")
          throw new Error("Expected fixture usage");
        return {
          screenPath: "home",
          viewport: view.viewport,
          colorScheme: view.colorScheme,
          key: view.usage.instances[0]!.key,
        };
      });
    await page.evaluate(
      (refs) =>
        window.viewerHarness.get("one").ref.current.highlightInstances(refs),
      refs,
    );
    await expect(page.locator(".mbk-highlight-layer")).toHaveCount(2, {
      timeout: 10000,
    });
    const frames = page.locator("#one iframe[data-mokly-frame-state]");
    await expect(frames).toHaveCount(2);
    for (const frame of await frames.all()) {
      const delivered = await frame.evaluate(
        (element: HTMLIFrameElement) => element.contentWindow!.location.href,
      );
      const url = new URL(delivered);
      expect(url.pathname).toMatch(/\/home\/index\.(mobile|desktop)$/);
      expect(url.search).toBe(encoded ? "?revision=2" : "");
      expect(url.hash).toBe(encoded ? "#position" : "");
      await expect(
        frame.contentFrame().getByRole("button", { name: "Styled action" }),
      ).toHaveCSS("background-color", "rgb(64, 32, 128)");
    }
    expect(
      fixture.redirected.requests
        .slice(firstRequest)
        .some((route) => route.endsWith(".html")),
    ).toBe(true);
    expect(
      fixture.redirected.requests
        .slice(firstRequest)
        .some((route) => route.endsWith("index.mobile")),
    ).toBe(true);
    await page.evaluate(() =>
      window.viewerHarness.get("one").ref.current.startPick(),
    );
    await frames
      .first()
      .contentFrame()
      .getByRole("button", { name: "Styled action" })
      .click();
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              window.viewerHarness
                .get("one")
                .events.filter(({ name }) => name === "click").length,
          ),
        { timeout: 10000 },
      )
      .toBe(1);
    const clicked = await page.evaluate(
      () =>
        window.viewerHarness
          .get("one")
          .events.find(({ name }) => name === "click")!.value,
    );
    expect(clicked).toMatchObject({
      instance: {
        screenPath: "home",
        key: refs.find((ref) => ref.viewport === "mobile")!.key,
      },
    });
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              window.viewerHarness
                .get("one")
                .events.filter(({ name }) => name === "pick-end").length,
          ),
        { timeout: 10000 },
      )
      .toBe(1);
    await page.evaluate(() =>
      window.viewerHarness.get("one").ref.current.startPick(),
    );
    await frames
      .first()
      .contentFrame()
      .getByRole("button", { name: "Styled action" })
      .press("Escape");
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              window.viewerHarness
                .get("one")
                .events.filter(({ name }) => name === "pick-end").length,
          ),
        { timeout: 10000 },
      )
      .toBe(2);
    expect(
      await page.evaluate(
        () =>
          window.viewerHarness
            .get("one")
            .events.filter(({ name }) => name === "pick-end")
            .at(-1)!.value,
      ),
    ).toMatchObject({ reason: "escape" });
    expect(
      await page.evaluate(() =>
        window.viewerHarness
          .get("one")
          .events.filter(({ name }) => name === "error"),
      ),
    ).toEqual([]);
  });
}

test("a redirected index page keeps its directory identity", async ({
  page,
}) => {
  await page.goto(fixture.redirected.url);
  const result = await page.evaluate(async () => {
    const adapter = (await import(
      `${location.origin}/mokly-viewer/client/same_origin_adapter.js`
    )) as typeof LocalAdapter;
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const mounted = await adapter.sameOriginAdapter().mount(frame, {
      url: new URL("/static/mokly-generated/guide/index.html", location.origin),
      usage: { status: "unavailable" },
    });
    const result = {
      pathname: frame.contentWindow!.location.pathname,
      ready: adapter.localFrameReady(frame, "guide/index.html"),
    };
    mounted.dispose();
    return result;
  });
  expect(result).toEqual({
    pathname: "/static/mokly-generated/guide/",
    ready: true,
  });
});

test("redirected private previews keep query identity during highlighting", async ({
  page,
}) => {
  await page.goto(fixture.redirected.url);
  await page.evaluate(
    async ({ path, usageJson }) => {
      const usage = JSON.parse(usageJson) as ComponentViewRecord;
      const adapter = (await import(
        `${location.origin}/mokly-viewer/client/same_origin_adapter.js`
      )) as typeof LocalAdapter;
      const frame = document.createElement("iframe");
      frame.id = "private-preview";
      frame.style.cssText = "width:390px;height:300px";
      document.body.append(frame);
      const state = window as unknown as FrameTestWindow;
      state.mounted = await adapter.temporaryPreviewAdapter().mount(frame, {
        url: new URL(`${path}?revision=2#position`, location.origin),
        usage: { status: "ready", ...usage },
      });
      await state.mounted.highlight([usage.instances[0]!.key], "highlight");
    },
    { path: fixture.temporaryPath, usageJson: JSON.stringify(fixture.usage) },
  );
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(1, {
    timeout: 10000,
  });
  await expect(
    page
      .frameLocator("#private-preview")
      .getByRole("button", { name: "Styled action" }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as FrameTestWindow).mounted.dispose(),
  );
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
});
