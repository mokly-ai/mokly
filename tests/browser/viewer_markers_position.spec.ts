import { expect } from "@playwright/test";

import type {
  CatalogueReadModel,
  InstanceRef,
  MoklyViewerProps,
} from "@mokly/viewer";

import { test } from "./browser_test.js";
import { markerFixture } from "./viewer_marker_fixture.js";
import {
  expectMarkerAligned,
  expectMarkerState,
  openMarkerViewer,
  screenInstance,
  setViewerMarkers,
  variantInstance,
} from "./viewer_marker_test_helpers.js";
import {
  canvasFrame,
  NARROW_WINDOW,
  viewportFrame,
} from "./workspace_actions.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof markerFixture>>;
test.beforeAll(async () => {
  fixture = await markerFixture();
});
test.afterAll(async () => fixture?.close());

for (const cross of [false, true]) {
  const adapter = cross ? "postMessage" : "same-origin";

  // The compact layout below the layout breakpoint shows one frame, pans
  // its canvas, shows the frame that the entry bar's picker names, and fits
  // that frame to the root; `viewer_markers_canvas.spec.ts` covers the
  // canvas's pan, zoom and refit from 900px wide. Canvas frames do not
  // expand, so the last step keeps the one-frame stage's expansion.
  test(`${adapter} below the layout breakpoint, marker tracks the canvas's pan, a picked frame, a resize and frame expansion without remounting`, async ({
    page,
  }) => {
    await page.setViewportSize(NARROW_WINDOW);
    await openMarkerViewer(page, fixture, cross);
    const shown = viewportFrame("mobile");
    const mobile = screenInstance(fixture, "mobile", "action");
    await setViewerMarkers(page, [{ id: "primary", instance: mobile }]);
    await expectMarkerState(page, "primary", "visible");
    await expect(page.locator("[data-mokly-marker]")).toHaveCount(1);
    await expectMarkerAligned(page, "primary", shown, "Visible");
    expect(
      await page.evaluate(() =>
        window.viewerHarness
          .get("one")
          .events.filter((event) => event.name === "markers"),
      ),
    ).toEqual([
      { name: "markers", value: [] },
      {
        name: "markers",
        value: [{ id: "primary", status: "visible" }],
      },
    ]);
    await expect(page.locator("[data-mokly-marker-layer]")).toHaveCSS(
      "pointer-events",
      "none",
    );
    await expect(page.locator('[data-marker-content="primary"]')).toHaveCSS(
      "pointer-events",
      "auto",
    );

    await page.evaluate(() =>
      window.viewerHarness.get("one").ref.current.startPick(),
    );
    await page.locator('[data-marker-content="primary"]').click();
    expect(
      await page.evaluate(() =>
        window.viewerHarness
          .get("one")
          .events.filter(
            (event) =>
              event.name === "marker-click" ||
              event.name === "click" ||
              event.name.startsWith("pick"),
          ),
      ),
    ).toEqual([
      { name: "pick-start", value: null },
      { name: "marker-click", value: "primary" },
    ]);
    await page.evaluate(() =>
      window.viewerHarness.get("one").ref.current.cancelPick(),
    );

    // A wheel over the canvas beside the frame pans it, and the marker with it.
    const marker = (id: string) =>
      page.locator(`[data-mokly-marker="${id}"]`).boundingBox();
    const firstTop = (await marker("primary"))!.y;
    const stage = await page
      .locator("#one [data-mokly-stage] .mbk-canvas-stage")
      .evaluate((element) => {
        const { x, y } = element.getBoundingClientRect();
        return { x, y };
      });
    await page.mouse.move(stage.x + 8, stage.y + 8);
    await page.mouse.wheel(0, 40);
    await expect
      .poll(async () => Math.round((await marker("primary"))!.y - firstTop))
      .toBe(-40);
    await expectMarkerAligned(page, "primary", shown, "Visible");

    // The picker shows the mounted Desktop frame, whose element stays.
    const desktop = screenInstance(fixture, "desktop", "action");
    await page
      .locator(canvasFrame("desktop"))
      .evaluate((frame: HTMLIFrameElement) => {
        frame.dataset["markerIdentity"] = "retained";
      });
    await setViewerMarkers(page, [{ id: "desktop", instance: desktop }]);
    await page
      .locator("#one")
      .getByLabel("Frame", { exact: true })
      .selectOption({ label: "Desktop · Light" });
    await expectMarkerState(page, "desktop", "visible");
    await expectMarkerAligned(
      page,
      "desktop",
      viewportFrame("desktop"),
      "Visible",
    );
    await expect(
      page.locator(
        `${viewportFrame("desktop")}[data-marker-identity="retained"]`,
      ),
    ).toHaveCount(1);

    // A smaller root fits the frame again at a smaller zoom.
    const initialWidth = (await marker("desktop"))!.width;
    await page.locator("#one").evaluate((element) => {
      element.style.width = "600px";
    });
    await expect
      .poll(async () => (await marker("desktop"))?.width)
      .toBeLessThan(initialWidth * 0.9);
    await expectMarkerAligned(
      page,
      "desktop",
      viewportFrame("desktop"),
      "Visible",
    );
    await expect(
      page.locator('iframe[data-marker-identity="retained"]'),
    ).toHaveCount(1);

    await page.locator(".browser-expand").click();
    await expect(page.locator(".mokly-viewer")).toHaveClass(/frame-expanded/);
    await expect(page.locator("[data-mokly-marker-layer]")).toHaveCSS(
      "z-index",
      "952",
    );
    await expectMarkerState(page, "desktop", "visible");
    await expectMarkerAligned(page, "desktop", 1, "Visible");
    await page.locator(".browser-expand").click();
    await expect(page.locator(".mokly-viewer")).not.toHaveClass(
      /frame-expanded/,
    );
  });

  test(`${adapter} markers distinguish in-frame visibility and nested scrolling`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 1400 });
    await openMarkerViewer(page, fixture, cross, { viewport: "mobile" });
    await page.locator("#one").evaluate((element) => {
      element.style.height = "1400px";
    });
    await setViewerMarkers(page, [
      { id: "lower", instance: screenInstance(fixture, "mobile", "lower") },
      { id: "nested", instance: screenInstance(fixture, "mobile", "nested") },
      { id: "hidden", instance: screenInstance(fixture, "mobile", "hidden") },
    ]);
    await expectMarkerState(page, "lower", "hidden");
    await expectMarkerState(page, "nested", "hidden");
    await expectMarkerState(page, "hidden", "hidden");
    const frame = page.locator(canvasFrame("mobile")).contentFrame();
    await frame.locator("html").evaluate(() => window.scrollTo(0, 650));
    await expectMarkerState(page, "lower", "visible");
    await expectMarkerState(page, "nested", "hidden");
    await frame.locator("[data-inner-scroll]").evaluate((element) => {
      element.scrollTop = 160;
    });
    await expectMarkerState(page, "nested", "visible");
    await frame.locator("html").evaluate(() => window.scrollTo(0, 0));
    await expectMarkerState(page, "lower", "hidden");
    await expectMarkerState(page, "nested", "hidden");
  });

  test(`${adapter} flow steps and selected variants use their exact marker refs`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await openMarkerViewer(page, fixture, cross);
    const flowRef = await page.evaluate(() => {
      const host = window.viewerHarness.get("one");
      const model = structuredClone(host.props.index) as CatalogueReadModel;
      const home = model.screens.find(({ path }) => path === "home")!;
      home.useCasePaths = ["tour"];
      model.useCases = [
        {
          kind: "use-case",
          path: "tour",
          detailId: home.detailId,

          title: "Tour",
          tags: [],
          details: home.details,
          changes: home.changes,
          steps: [{ screenPath: "home" }, { screenPath: "home" }],
        },
      ];
      model.tree = [...model.tree, { kind: "entry", path: "tour" }];
      const view = host.details["home"]!.views.find(
        (view) => view.viewport === "desktop" && view.colorScheme === "light",
      )!;
      if (view.usage.status !== "ready") throw new Error("Expected usage");
      const instance: InstanceRef = {
        screenPath: "home",
        stepIndex: 1,
        viewport: "desktop",
        colorScheme: "light",
        key: view.usage.instances.find(({ id }) => id === "action")!.key,
      };
      host.props = {
        ...host.props,
        index: model,
        defaultSelection: { screenPath: "tour", viewport: "both" },
      } as MoklyViewerProps;
      host.setMarkers([{ id: "flow", instance }]);
      return instance;
    });
    expect(flowRef.stepIndex).toBe(1);
    await page.locator(".mbk-flow").evaluate((element) => {
      element.style.height = "600px";
      element.style.flex = "none";
    });
    await expectMarkerState(page, "flow", "hidden");
    await page.locator(".mbk-flow").evaluate((element) => {
      const frame = element.querySelectorAll("iframe")[1]!;
      element.scrollTop +=
        frame.getBoundingClientRect().top - element.getBoundingClientRect().top;
    });
    await expectMarkerState(page, "flow", "visible");
    await expectMarkerAligned(page, "flow", 1, "Visible");

    await page.evaluate(() => window.viewerHarness.remove("one"));
    // The canvas shows the variant's row of its set in desktop views.
    await page.evaluate(
      ({ cross, instance }) => {
        const host = window.viewerHarness.start("one", {
          cross,
          defaultSelection: {
            screenPath: "pane/second",
            viewport: "mobile",
          },
        });
        host.setMarkers([{ id: "variant", instance }]);
      },
      { cross, instance: variantInstance(fixture, "desktop") },
    );
    const second = `${canvasFrame("desktop")}[data-workspace-variant="pane/second"]`;
    await expectMarkerState(page, "variant", "visible");
    await expect(
      page.locator(second).contentFrame().getByText("Second content"),
    ).toBeVisible();
    await expectMarkerAligned(page, "variant", second, "Inside");
  });
}
