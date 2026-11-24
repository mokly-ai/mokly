import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { InstanceRef } from "@mokly/viewer";

import type { markerFixture } from "./viewer_marker_fixture.js";

import type {} from "./viewer_harness.js";

export type MarkerFixture = Awaited<ReturnType<typeof markerFixture>>;

export function screenInstance(
  fixture: MarkerFixture,
  viewport: "mobile" | "desktop",
  id: string,
): InstanceRef {
  const screen = fixture.details.current["home"]!;
  const view = screen.views.find(
    (view) => view.viewport === viewport && view.colorScheme === "light",
  )!;
  if (view.usage.status !== "ready") throw new Error("Expected ready usage");
  return {
    screenPath: "home",
    viewport,
    colorScheme: "light",
    key: view.usage.instances.find((instance) => instance.id === id)!.key,
  };
}

/**
 * The Action instance of the saved variant `pane/second` in one viewport's
 * Light view: the canvas shows a component's desktop views.
 */
export function variantInstance(
  fixture: MarkerFixture,
  viewport: "mobile" | "desktop" = "mobile",
): InstanceRef {
  const component = fixture.index.components.find(
    ({ path }) => path === "pane",
  )!;
  const variant = fixture.index.components
    .filter((entry) => entry.variantOf === component.path)
    .find(({ path }) => path === "pane/second")!;
  const view = fixture.details.current[variant.path]!.views.find(
    (view) => view.viewport === viewport && view.colorScheme === "light",
  )!;
  if (view.usage.status !== "ready") throw new Error("Expected ready usage");
  return {
    screenPath: "pane/second",
    viewport,
    colorScheme: "light",
    key: view.usage.instances.find(
      (instance) => instance.componentId === "action",
    )!.key,
  };
}

export async function openMarkerViewer(
  page: Page,
  fixture: MarkerFixture,
  cross: boolean,
  selection: Record<string, unknown> = {},
  id = "one",
) {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(
    ({ cross, selection, id }) =>
      window.viewerHarness.start(id, {
        cross,
        defaultSelection: {
          screenPath: "home",
          viewport: "both",
          ...selection,
        },
      }),
    { cross, selection, id },
  );
  await page.waitForFunction(
    (id) => Boolean(window.viewerHarness.get(id).ref.current),
    id,
  );
}

export async function setViewerMarkers(
  page: Page,
  markers: readonly { id: string; instance: InstanceRef }[],
  id = "one",
) {
  await page.evaluate(
    ({ markers, id }) => window.viewerHarness.get(id).setMarkers(markers),
    { markers, id },
  );
}

export async function expectMarkerState(
  page: Page,
  markerId: string,
  status: string,
  hostId = "one",
) {
  await expect
    .poll(() =>
      page.evaluate(
        ({ markerId, hostId }) => {
          const events = window.viewerHarness
            .get(hostId)
            .events.filter((event) => event.name === "markers");
          const states = events.at(-1)?.value as
            { id: string; status: string }[] | undefined;
          return states?.find((state) => state.id === markerId)?.status;
        },
        { markerId, hostId },
      ),
    )
    .toBe(status);
}

/**
 * Expect the marker over the labelled button of a frame: the frame at
 * `frame` among the shown frames, or the frame that a selector names.
 */
export async function expectMarkerAligned(
  page: Page,
  markerId: string,
  frame: number | string,
  label: string,
) {
  const target =
    typeof frame === "number"
      ? page.locator("iframe[data-mokly-frame-state]").nth(frame)
      : page.locator(frame);
  await expect
    .poll(async () => {
      const marker = await page
        .locator(`[data-mokly-marker="${markerId}"]`)
        .boundingBox();
      const button = await target
        .contentFrame()
        .getByRole("button", { name: label, exact: true })
        .boundingBox();
      if (!marker || !button) return Number.POSITIVE_INFINITY;
      return Math.max(
        ...(["x", "y", "width", "height"] as const).map((key) =>
          Math.abs(marker[key] - button[key]),
        ),
      );
    })
    .toBeLessThan(2);
}
