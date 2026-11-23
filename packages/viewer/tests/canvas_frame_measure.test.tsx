import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";

import type { Box, FrameAdapter, MountedFrame } from "@mokly/frame";

import type { ShellCatalogueRoutedEntry } from "../src/catalogue/scoped_types.js";
import {
  DESKTOP_FRAME_SIZE,
  type CanvasFrameSize,
} from "../src/shell/canvas_frame_size.js";
import {
  workspaceFrames,
  type CanvasFramePlan,
} from "../src/shell/canvas_frames.js";
import { CanvasLiveFrame } from "../src/shell/canvas_live_frame.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { publicWorkspace } from "../src/shell/public_workspace.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { ShellStoreProvider } from "../src/shell/store.js";

import { indexFixture, shellModelFixture } from "./catalogue_v9_fixture.js";
import { FakeDataSource, flush } from "./data_fakes.js";

const ORIGIN = "https://catalogue.test";

/** A leaf component's content box: a 160 × 40 button 24px from the top left. */
const BUTTON: Box = { x: 24, y: 24, width: 160, height: 40 };

/** The size that the button's frame takes: its box with the same margins. */
const BUTTON_FRAME: CanvasFrameSize = { width: 208, height: 88 };

/** An adapter whose mounts answer `contentBox` with `measure`, if given. */
function measuringAdapter(measure?: () => Promise<Box | null>) {
  const calls = { measures: 0, mounts: 0 };
  const adapter: FrameAdapter = {
    async mount() {
      calls.mounts += 1;
      const mounted: MountedFrame = {
        dispose: () => undefined,
        highlight: async () => undefined,
        listInstanceBoundaries: async () => [],
        scrollTo: async () => undefined,
        subscribe: () => () => undefined,
        ...(measure
          ? {
              contentBox: () => {
                calls.measures += 1;
                return measure();
              },
            }
          : {}),
      };
      return mounted;
    },
  };
  return { adapter, calls };
}

/** The frames of a path's canvas in the fixture catalogue, with dark views. */
function plans(path: string): CanvasFramePlan[] {
  const model = shellModelFixture(
    indexFixture((index) => {
      for (const entry of [...index.screens, ...index.components]) {
        entry.colorSchemes = ["light", "dark"];
        entry.views = entry.views.flatMap((view) => [
          view,
          { ...view, colorScheme: "dark" as const },
        ]);
      }
    }),
  );
  const catalogue = createCatalogue(model);
  const entry = catalogue.byPath.get(path) as ShellCatalogueRoutedEntry;
  assert.ok(entry.kind === "screen" || entry.kind === "component", path);
  const data = publicWorkspace(catalogue, model, entry);
  return workspaceFrames(data, "both", data.views);
}

/** One canvas frame in a live shell whose frames mount through `adapter`. */
function mountFrame(
  adapter: FrameAdapter,
  plan: CanvasFramePlan,
  sizes: [string, CanvasFrameSize][],
) {
  const url = `${ORIGIN}/view/${plan.entry.path}/`;
  const frame = (shown: CanvasFramePlan): ReactNode => (
    <ShellStoreProvider
      context={{ embedded: true }}
      frameAdapter={adapter}
      frameBaseUrl={ORIGIN}
      index={indexFixture()}
      interactive
      route={(catalogue) => routeFromUrl(catalogue, new URL(url))}
      source={new FakeDataSource()}
    >
      <CanvasLiveFrame
        hasDarkFragments={false}
        onSize={(key, size) => sizes.push([key, size])}
        plan={shown}
        size={DESKTOP_FRAME_SIZE}
      />
    </ShellStoreProvider>
  );
  const view = render(frame(plan));
  return {
    rerender: (shown: CanvasFramePlan) => view.rerender(frame(shown)),
    unmount: () => view.unmount(),
  };
}

/**
 * Register a DOM for one test. Its frames load an empty page without a
 * request: the fake adapter mounts them, and their pages stay unread.
 */
function registerDom(t: TestContext): void {
  GlobalRegistrator.register({
    url: ORIGIN,
    settings: {
      disableJavaScriptEvaluation: true,
      enableIframePageLoading: true,
      fetch: {
        interceptor: {
          beforeAsyncRequest: async ({ window }) =>
            new window.Response("<!doctype html><title>Frame</title>", {
              headers: { "content-type": "text/html" },
            }),
        },
      },
    },
  });
  t.after(() => GlobalRegistrator.unregister());
}

test("a component frame measures its document once after each load and takes the content's size", async (t) => {
  registerDom(t);
  const [light, dark] = plans("components/action");
  assert.ok(light?.kind === "component" && dark?.preview);
  const { adapter, calls } = measuringAdapter(async () => BUTTON);
  const sizes: [string, CanvasFrameSize][] = [];
  const frame = mountFrame(adapter, light, sizes);
  try {
    await act(flush);
    assert.deepEqual(calls, { measures: 1, mounts: 1 });
    assert.deepEqual(sizes, [[light.key, BUTTON_FRAME]]);
    // A render that loads no other document measures nothing again.
    frame.rerender({ ...light });
    await act(flush);
    assert.deepEqual(calls, { measures: 1, mounts: 1 });
    // The frame's next document is measured once it loads.
    frame.rerender({ ...light, preview: dark.preview });
    await act(flush);
    assert.deepEqual(calls, { measures: 2, mounts: 2 });
    assert.deepEqual(sizes, [
      [light.key, BUTTON_FRAME],
      [light.key, BUTTON_FRAME],
    ]);
  } finally {
    frame.unmount();
  }
});

test("a component frame keeps the desktop size when its document has no measurement", async (t) => {
  registerDom(t);
  const [plan] = plans("components/action");
  assert.ok(plan);
  for (const measure of [
    undefined,
    async () => null,
    () => Promise.reject(new Error("limit")),
  ]) {
    const { adapter, calls } = measuringAdapter(measure);
    const sizes: [string, CanvasFrameSize][] = [];
    const frame = mountFrame(adapter, plan, sizes);
    try {
      await act(flush);
    } finally {
      frame.unmount();
    }
    assert.deepEqual(calls, { measures: measure ? 1 : 0, mounts: 1 });
    assert.deepEqual(sizes, [[plan.key, DESKTOP_FRAME_SIZE]]);
  }
});

test("a measurement that ends after the frame loads another document is dropped", async (t) => {
  registerDom(t);
  const [light, dark] = plans("components/action");
  assert.ok(light && dark?.preview);
  const pending: ((box: Box) => void)[] = [];
  const { adapter } = measuringAdapter(
    () => new Promise<Box>((resolve) => pending.push(resolve)),
  );
  const sizes: [string, CanvasFrameSize][] = [];
  const frame = mountFrame(adapter, light, sizes);
  try {
    await act(flush);
    frame.rerender({ ...light, preview: dark.preview });
    await act(flush);
    assert.equal(pending.length, 2);
    pending[0]!({ x: 0, y: 0, width: 900, height: 500 });
    pending[1]!(BUTTON);
    await act(flush);
    assert.deepEqual(sizes, [[light.key, BUTTON_FRAME]]);
  } finally {
    frame.unmount();
  }
});

test("a screen frame keeps its viewport's size and measures nothing", async (t) => {
  registerDom(t);
  const [desktop] = plans("product/browse/home");
  assert.ok(desktop?.kind === "desktop");
  const { adapter, calls } = measuringAdapter(async () => BUTTON);
  const sizes: [string, CanvasFrameSize][] = [];
  const frame = mountFrame(adapter, desktop, sizes);
  try {
    await act(flush);
    assert.deepEqual(calls, { measures: 0, mounts: 1 });
    assert.deepEqual(sizes, []);
  } finally {
    frame.unmount();
  }
});
