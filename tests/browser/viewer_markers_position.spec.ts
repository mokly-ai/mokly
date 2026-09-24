import { expect, test } from "@playwright/test";

import type {
  CatalogueReadModel,
  InstanceRef,
  MoklyViewerProps,
} from "@mokly/viewer";

import { markerFixture } from "./viewer_marker_fixture.js";
import {
  expectMarkerAligned,
  expectMarkerState,
  openMarkerViewer,
  screenInstance,
  setViewerMarkers,
  variantInstance,
} from "./viewer_marker_test_helpers.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof markerFixture>>;
test.beforeAll(async () => {
  fixture = await markerFixture();
});
test.afterAll(async () => fixture?.close());

for (const cross of [false, true]) {
  const adapter = cross ? "postMessage" : "same-origin";

  test(`${adapter} marker tracks outer scroll, resize and frame expansion without remounting`, async ({
    page,
  }) => {
    await openMarkerViewer(page, fixture, cross);
    await page.locator(".mbk-stage").evaluate((stage) => {
      stage.style.height = "600px";
      stage.style.flex = "none";
    });
    const mobile = screenInstance(fixture, "mobile", "action");
    await setViewerMarkers(page, [{ id: "primary", instance: mobile }]);
    await expectMarkerState(page, "primary", "visible");
    await expect(page.locator("[data-mokly-marker]")).toHaveCount(1);
    await expectMarkerAligned(page, "primary", 0, "Visible");
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

    const firstTop = (await page
      .locator('[data-mokly-marker="primary"]')
      .boundingBox())!.y;
    await page.locator(".mbk-stage").evaluate((stage) => {
      stage.scrollTop = 40;
    });
    await expect
      .poll(
        async () =>
          (await page.locator('[data-mokly-marker="primary"]').boundingBox())
            ?.y,
      )
      .toBeLessThan(firstTop - 10);

    const desktop = screenInstance(fixture, "desktop", "action");
    await page.evaluate((desktop) => {
      const frame = document.querySelectorAll<HTMLIFrameElement>(
        "iframe[data-mokly-fragment-frame]",
      )[1]!;
      frame.dataset["markerIdentity"] = "retained";
      window.viewerHarness
        .get("one")
        .setMarkers([{ id: "desktop", instance: desktop }]);
    }, desktop);
    await expectMarkerState(page, "desktop", "visible");
    await expect(
      page.locator('iframe[data-marker-identity="retained"]'),
    ).toHaveCount(1);
    const initialWidth = (await page
      .locator('[data-mokly-marker="desktop"]')
      .boundingBox())!.width;
    await page.locator("#one").evaluate((element) => {
      element.style.width = "900px";
    });
    await expect
      .poll(
        async () =>
          (await page.locator('[data-mokly-marker="desktop"]').boundingBox())
            ?.width,
      )
      .toBeLessThan(initialWidth - 20);

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
    const frame = page
      .locator('iframe[data-workspace-frame="mobile"]')
      .contentFrame();
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
      const model = structuredClone(host.props.catalogue) as CatalogueReadModel;
      const home = model.screens.find(({ id }) => id === "home")!;
      home.useCaseIds = ["tour"];
      model.useCases = [
        {
          kind: "use-case",
          id: "tour",
          navPath: [],
          title: "Tour",
          route: "flows/tour.html",
          tags: [],
          details: home.details,
          changes: { status: "disabled" },
          steps: [{ screenId: "home" }, { screenId: "home" }],
        },
      ];
      model.tree.pages = [...model.tree.pages, { kind: "entry", id: "tour" }];
      const view = home.views.find(
        (view) => view.viewport === "desktop" && view.colorScheme === "light",
      )!;
      if (view.usage.status !== "ready") throw new Error("Expected usage");
      const instance: InstanceRef = {
        screenId: "home",
        stepIndex: 1,
        viewport: "desktop",
        colorScheme: "light",
        key: view.usage.instances.find(({ id }) => id === "action")!.key,
      };
      host.props = {
        ...host.props,
        catalogue: model,
        defaultSelection: { screenId: "tour", viewport: "both" },
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
    await page.evaluate(
      ({ cross, instance }) => {
        const host = window.viewerHarness.start("one", {
          cross,
          defaultSelection: {
            screenId: "pane",
            variantId: "second",
            viewport: "mobile",
          },
        });
        host.setMarkers([{ id: "variant", instance }]);
      },
      { cross, instance: variantInstance(fixture) },
    );
    await expectMarkerState(page, "variant", "visible");
    await expect(
      page
        .locator('iframe[data-workspace-frame="mobile"]')
        .contentFrame()
        .getByText("Second content"),
    ).toBeVisible();
    await expectMarkerAligned(page, "variant", 0, "Inside");
  });
}
