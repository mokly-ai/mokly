/**
 * A comparison section controller over fake viewports, frames and documents,
 * shared by the controller's page and region tests.
 */

import type { ComparisonSide } from "../src/shell/comparison_scroll_owner.js";
import { createComparisonScrollSync } from "../src/shell/comparison_scroll_sync.js";
import type { ComparisonScrollOptions } from "../src/shell/comparison_scroll_types.js";

import {
  FakeDocument,
  FakeFrame,
  FakeStyle,
  FakeViewport,
  fakeEnvironment,
} from "./comparison_scroll_fakes.js";

/** Every fake document and viewport is this size. */
export const SIZE = { height: 700, width: 1000 };

/** A controller with `viewports` shared viewports and a layer factory. */
export function setup(
  viewports = 1,
  options: Omit<ComparisonScrollOptions, "environment"> = {},
) {
  const fake = fakeEnvironment();
  const sync = createComparisonScrollSync({
    ...options,
    environment: fake.environment,
  });
  const shared = Array.from(
    { length: viewports },
    () => new FakeViewport(SIZE),
  );
  for (const viewport of shared)
    sync.attachViewport(
      viewport as unknown as HTMLElement,
      viewport.spacer as unknown as HTMLElement,
    );
  const layer = (viewport = shared[0]!, side: ComparisonSide = "after") => {
    const frame = new FakeFrame();
    const surface = { style: new FakeStyle() };
    const release = sync.attachLayer({
      frame: frame as unknown as HTMLIFrameElement,
      side,
      surface: surface as unknown as HTMLElement,
      viewport: viewport as unknown as HTMLElement,
    });
    return { frame, release, surface };
  };
  return { fake, layer, shared, sync };
}

/** A presented document and the content size it parses to. */
export function presented(content: { height: number; width?: number }) {
  const doc = new FakeDocument(SIZE);
  return {
    doc,
    content: { height: content.height, width: content.width ?? SIZE.width },
  };
}

/** A cancelable keydown event with a target and modifiers. */
export function key(
  name: string,
  target: unknown = null,
  modifiers: Partial<Record<"ctrlKey" | "shiftKey", boolean>> = {},
): Event {
  const event = Object.assign(new Event("keydown", { cancelable: true }), {
    altKey: false,
    ctrlKey: false,
    isComposing: false,
    key: name,
    metaKey: false,
    shiftKey: false,
    ...modifiers,
  });
  if (target) Object.defineProperty(event, "target", { value: target });
  return event;
}
