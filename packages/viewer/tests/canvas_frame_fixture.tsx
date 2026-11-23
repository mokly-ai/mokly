/**
 * Canvas frames in a live shell for unit tests: a DOM whose frames load an
 * empty page, the fixture catalogue's canvas frames, and a fake adapter that
 * records each mount.
 */

import assert from "node:assert/strict";
import type { TestContext } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

import type { Box, FrameAdapter, FrameMount, MountedFrame } from "@mokly/frame";

import type { ShellCatalogueRoutedEntry } from "../src/catalogue/scoped_types.js";
import {
  workspaceFrames,
  type CanvasFramePlan,
} from "../src/shell/canvas_frames.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { publicWorkspace } from "../src/shell/public_workspace.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { ShellStoreProvider } from "../src/shell/store.js";

import { indexFixture, shellModelFixture } from "./catalogue_v9_fixture.js";
import { FakeDataSource } from "./data_fakes.js";

export const ORIGIN = "https://catalogue.test";

/**
 * Register a DOM for one test. Its frames load an empty page without a
 * request: the fake adapter mounts them, and their pages stay unread.
 */
export function registerDom(t: TestContext): void {
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

/** The frames of a path's canvas in the fixture catalogue, with dark views. */
export function canvasPlans(path: string): CanvasFramePlan[] {
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

/**
 * An adapter that records the view of each mount and answers `contentBox`
 * with `measure`, if given.
 */
export function fakeAdapter(measure?: () => Promise<Box | null>) {
  const calls = { measures: 0, mounts: 0 };
  const mounts: FrameMount[] = [];
  const adapter: FrameAdapter = {
    async mount(_frame, view) {
      calls.mounts += 1;
      mounts.push(view);
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
  return { adapter, calls, mounts };
}

/** Render a node in a live shell on `path`, whose frames mount through `adapter`. */
export function renderInShell(
  adapter: FrameAdapter,
  path: string,
  node: ReactNode,
) {
  const url = `${ORIGIN}/view/${path}/`;
  const shell = (child: ReactNode) => (
    <ShellStoreProvider
      context={{ embedded: true }}
      frameAdapter={adapter}
      frameBaseUrl={ORIGIN}
      index={indexFixture()}
      interactive
      route={(catalogue) => routeFromUrl(catalogue, new URL(url))}
      source={new FakeDataSource()}
    >
      {child}
    </ShellStoreProvider>
  );
  const view = render(shell(node));
  return {
    container: view.container,
    rerender: (next: ReactNode) => view.rerender(shell(next)),
    unmount: () => view.unmount(),
  };
}
