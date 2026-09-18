import { expect, test } from "@playwright/test";

import type { CatalogueReadModel, MoklyViewerProps } from "@mokly/viewer";

import { markerFixture } from "./viewer_marker_fixture.js";
import {
  expectMarkerState,
  openMarkerViewer,
  screenInstance,
  setViewerMarkers,
} from "./viewer_marker_test_helpers.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof markerFixture>>;
test.beforeAll(async () => {
  fixture = await markerFixture();
});
test.afterAll(async () => fixture?.close());

for (const cross of [false, true]) {
  const adapter = cross ? "postMessage" : "same-origin";

  test(`${adapter} marker states cover hidden, missing, other-screen, comparison and pending views`, async ({
    page,
  }) => {
    await openMarkerViewer(page, fixture, cross, { viewport: "mobile" });
    const visible = screenInstance(fixture, "mobile", "action");
    const hidden = screenInstance(fixture, "mobile", "hidden");
    const missing = { ...visible, key: "f".repeat(64) };
    await setViewerMarkers(page, [
      { id: "hidden", instance: hidden },
      { id: "missing", instance: missing },
    ]);
    await expectMarkerState(page, "hidden", "hidden");
    await expectMarkerState(page, "missing", "unavailable");
    await expect(page.locator("[data-mokly-marker]")).toHaveCount(0);

    await setViewerMarkers(page, [
      { id: "duplicate", instance: visible },
      { id: "duplicate", instance: hidden },
    ]);
    await expect(page.locator("[data-mokly-marker]")).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window.viewerHarness
                .get("one")
                .events.filter((event) => event.name === "error")
                .at(-1)?.value as { code?: string } | undefined
            )?.code,
        ),
      )
      .toBe("markers");
    await setViewerMarkers(page, [{ id: "visible", instance: visible }]);
    await expectMarkerState(page, "visible", "visible");

    await page.evaluate(() =>
      window.viewerHarness.get("one").ref.current.select({
        screenId: "pane",
        variantId: "default",
      }),
    );
    await expectMarkerState(page, "visible", "unavailable");
    await page.evaluate(() =>
      window.viewerHarness.get("one").ref.current.select({ screenId: "home" }),
    );
    await expectMarkerState(page, "visible", "visible");

    await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>("#one .mokly-viewer")!;
      const current = document.createElement("button");
      current.dataset["diffMode"] = "current";
      current.setAttribute("aria-pressed", "false");
      const side = document.createElement("button");
      side.dataset["diffMode"] = "side";
      side.setAttribute("aria-pressed", "true");
      root.append(current, side);
      root.dispatchEvent(new CustomEvent("mokly:comparison"));
    });
    await expectMarkerState(page, "visible", "unavailable");
    await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>("#one .mokly-viewer")!;
      root
        .querySelector('[data-diff-mode="current"]')!
        .setAttribute("aria-pressed", "true");
      root
        .querySelector('[data-diff-mode="side"]')!
        .setAttribute("aria-pressed", "false");
      root.dispatchEvent(new CustomEvent("mokly:comparison"));
    });
    await expectMarkerState(page, "visible", "visible");

    await page.evaluate((visible) => {
      const host = window.viewerHarness.get("one");
      const model = structuredClone(host.props.catalogue) as CatalogueReadModel;
      const home = model.screens.find(({ id }) => id === "home")!;
      home.views = home.views.map((view) =>
        view.viewport === "mobile" && view.colorScheme === "light"
          ? { ...view, usage: { status: "pending" as const } }
          : view,
      );
      host.props = {
        ...host.props,
        catalogue: model,
        defaultSelection: {
          screenId: "home",
          viewport: "mobile",
          colorScheme: "light",
        },
      } as MoklyViewerProps;
      host.setMarkers([{ id: "pending", instance: visible }]);
    }, visible);
    await expectMarkerState(page, "pending", "unavailable");
    await setViewerMarkers(page, []);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const values = window.viewerHarness
            .get("one")
            .events.filter((event) => event.name === "markers");
          return values.at(-1)?.value;
        }),
      )
      .toEqual([]);
  });

  test(`${adapter} one failing measurement reports one marker error for all targets`, async ({
    page,
  }) => {
    await openMarkerViewer(page, fixture, cross, { viewport: "mobile" });
    const visible = screenInstance(fixture, "mobile", "action");
    await page.evaluate((visible) => {
      const host = window.viewerHarness.get("one");
      const original = host.props.frameAdapter!;
      let failed = false;
      host.props = {
        ...host.props,
        frameAdapter: {
          async mount(frame, options) {
            const mounted = await original.mount(frame, options);
            return {
              ...mounted,
              async listInstanceBoundaries() {
                if (!failed) {
                  failed = true;
                  throw new Error("Private measurement details");
                }
                return mounted.listInstanceBoundaries();
              },
            };
          },
        },
      } as MoklyViewerProps;
      host.setMarkers([
        { id: "first", instance: visible },
        { id: "second", instance: visible },
      ]);
    }, visible);
    await expectMarkerState(page, "first", "unavailable");
    await expectMarkerState(page, "second", "unavailable");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.viewerHarness
              .get("one")
              .events.filter(
                (event) =>
                  event.name === "error" &&
                  (event.value as { code?: string }).code === "markers",
              ).length,
        ),
      )
      .toBe(1);
  });

  test(`${adapter} unmount fences an asynchronous marker measurement`, async ({
    page,
  }) => {
    await openMarkerViewer(page, fixture, cross, { viewport: "mobile" });
    const visible = screenInstance(fixture, "mobile", "action");
    await page.evaluate((visible) => {
      const host = window.viewerHarness.get("one");
      const original = host.props.frameAdapter!;
      let release = () => {};
      const waiting = new Promise<void>((resolve) => {
        release = resolve;
      });
      (window as unknown as { releaseMarker: () => void }).releaseMarker =
        release;
      (window as unknown as { markerWaiting: boolean }).markerWaiting = false;
      host.props = {
        ...host.props,
        frameAdapter: {
          async mount(frame, options) {
            const mounted = await original.mount(frame, options);
            return {
              ...mounted,
              async listInstanceBoundaries() {
                const boundaries = await mounted.listInstanceBoundaries();
                (
                  window as unknown as { markerWaiting: boolean }
                ).markerWaiting = true;
                await waiting;
                return boundaries;
              },
            };
          },
        },
      } as MoklyViewerProps;
      host.setMarkers([{ id: "late", instance: visible }]);
    }, visible);
    await page.waitForFunction(
      () => (window as unknown as { markerWaiting: boolean }).markerWaiting,
    );
    const before = await page.evaluate(
      () => window.viewerHarness.get("one").events.length,
    );
    await page.evaluate(() => {
      window.viewerHarness.remove("one");
      (window as unknown as { releaseMarker: () => void }).releaseMarker();
    });
    await page.evaluate(async () => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    expect(
      await page.evaluate(() => window.viewerHarness.get("one").events.length),
    ).toBe(before);
    await expect(page.locator("#one")).toHaveCount(0);
  });
}
