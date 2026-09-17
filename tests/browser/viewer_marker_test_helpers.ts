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
  const screen = fixture.catalogue.screens.find(({ id }) => id === "home")!;
  const view = screen.views.find(
    (view) => view.viewport === viewport && view.colorScheme === "light",
  )!;
  if (view.usage.status !== "ready") throw new Error("Expected ready usage");
  return {
    screenId: "home",
    viewport,
    colorScheme: "light",
    key: view.usage.instances.find((instance) => instance.id === id)!.key,
  };
}

export function variantInstance(fixture: MarkerFixture): InstanceRef {
  const component = fixture.catalogue.components.find(
    ({ id }) => id === "pane",
  )!;
  const variant = component.variants.find(({ id }) => id === "second")!;
  const view = variant.views.find(
    (view) => view.viewport === "mobile" && view.colorScheme === "light",
  )!;
  if (view.usage.status !== "ready") throw new Error("Expected ready usage");
  return {
    screenId: "pane",
    variantId: "second",
    viewport: "mobile",
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
          screenId: "home",
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

export async function expectMarkerAligned(
  page: Page,
  markerId: string,
  frameIndex: number,
  label: string,
) {
  await expect
    .poll(async () => {
      const marker = await page
        .locator(`[data-mokly-marker="${markerId}"]`)
        .boundingBox();
      const target = await page
        .locator("iframe[data-mokly-fragment-frame]")
        .nth(frameIndex)
        .contentFrame()
        .getByRole("button", { name: label, exact: true })
        .boundingBox();
      if (!marker || !target) return Number.POSITIVE_INFINITY;
      return Math.max(
        ...(["x", "y", "width", "height"] as const).map((key) =>
          Math.abs(marker[key] - target[key]),
        ),
      );
    })
    .toBeLessThan(2);
}
