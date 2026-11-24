/**
 * The titles of the comparison panes on the canvas: each pane's frame names
 * its own canvas frame, so a Dark frame that shows its row's Light view, as
 * the row has no Dark view, does not repeat the Light frame's titles.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { render, waitFor } from "@testing-library/react";
import { Fragment } from "react";

import type { CanvasSectionFrame } from "@mokly/ui/canvas-section";

import { ComparisonCanvas } from "../src/shell/comparison_canvas.js";
import { useCanvasComparison } from "../src/shell/comparison_canvas_context.js";
import type { ComparisonEnvironment } from "../src/shell/comparison_context.js";
import type { ComparisonFramePlan } from "../src/shell/comparison_rows.js";
import { comparedFrames } from "../src/shell/comparison_selection.js";
import type { ComparisonController } from "../src/shell/use_comparison.js";

import { ShellStoreFixture } from "./shell_markup.js";

const ORIGIN = "https://catalogue.test";
const ROOT = `${ORIGIN}/mokly-viewer/diffs/generations/one/`;
const HOME = "product/browse/home";

/** Home's Desktop · Light frame, and below it its Desktop · Dark frame. */
const PLANS: readonly ComparisonFramePlan[] = (
  [
    ["light", "Light"],
    ["dark", "Dark"],
  ] as const
).map(([scheme, title], row) => ({
  column: 0,
  entry: { path: HOME },
  key: `desktop-${scheme}`,
  kind: "desktop",
  label: `Desktop · ${title}`,
  name: `Desktop · ${title}`,
  row,
  scheme,
  viewport: "desktop",
}));

/** The live frames that the workspace's canvas gives the compare. */
const LIVE: readonly CanvasSectionFrame[] = PLANS.map(({ key, row }) => ({
  column: 0,
  height: 800,
  key,
  node: null,
  row,
  width: 1280,
}));

/** The frames that the canvas shows, drawn as the compare gives them. */
function Section() {
  const comparison = useCanvasComparison();
  const frames = comparison ? comparison.frames(LIVE) : LIVE;
  return (
    <>
      {frames
        .filter((frame) => !frame.hidden)
        .map((frame) => (
          <Fragment key={frame.key}>{frame.node}</Fragment>
        ))}
    </>
  );
}

/** A loaded Overlay comparison of Home. */
function controller(): ComparisonController {
  const generation = { url: ROOT };
  return {
    busy: false,
    generations: new Map([[HOME, generation]]),
    loaded: generation,
    mode: "overlay",
    presentation: {
      colorScheme: "light",
      mode: "overlay",
      requestedColorScheme: "light",
      viewport: "both",
    },
    refresh: () => undefined,
    retry: () => undefined,
    selectMode: () => undefined,
  };
}

/**
 * Give each document `fonts`, as each browser document has: a pane's frame
 * listens to its document's fonts, and happy-dom gives a document none. A
 * frame's document shares the prototype that this stub extends. The same
 * stub serves `removed_preview_detail.test.tsx`.
 */
function stubDocumentFonts(): void {
  const prototype: object = Object.getPrototypeOf(
    Object.getPrototypeOf(document),
  );
  if ("fonts" in prototype) return;
  const sets = new WeakMap<object, EventTarget>();
  Object.defineProperty(prototype, "fonts", {
    configurable: true,
    get(this: object) {
      const known = sets.get(this);
      if (known) return known;
      const created = new EventTarget();
      sets.set(this, created);
      return created;
    },
  });
}

/** An environment that answers every snapshot with a document. */
const environment: ComparisonEnvironment = {
  baseUrl: ORIGIN,
  delivery: () => ({ kind: "live" }),
  fetch: async (input) => {
    const response = new Response("<!doctype html><p>Version</p>", {
      headers: { "content-type": "text/html" },
    });
    Object.defineProperty(response, "url", { value: String(input) });
    return response;
  },
};

test("a Dark frame that shows its Light view names its own frame in its panes' titles", async (t) => {
  GlobalRegistrator.register();
  t.after(() => GlobalRegistrator.unregister());
  stubDocumentFonts();
  // Home has no Dark view of its desktop viewport, so its Dark frame
  // compares the Light view.
  const frames = comparedFrames(
    PLANS,
    new Map([[HOME, { url: ROOT }]]),
    () => ({
      compared: {
        basePath: HOME,
        path: HOME,
        reasons: [],
        views: [
          {
            colorScheme: "light",
            ignoredIds: [],
            state: "changed",
            viewport: "desktop",
          },
        ],
      },
      usingChanged: new Set(),
    }),
  );
  const view = render(
    <ShellStoreFixture
      comparisonEnvironment={environment}
      path={`/view/${HOME}/`}
    >
      <ComparisonCanvas
        comparison={controller()}
        entryId={HOME}
        entryKind="screen"
        frames={frames}
        plans={new Map(PLANS.map((plan) => [plan.key, plan]))}
        sideKey={undefined}
      >
        <Section />
      </ComparisonCanvas>
    </ShellStoreFixture>,
  );
  try {
    const titles = () =>
      [...view.container.querySelectorAll("iframe")].map(
        (frame) => frame.title,
      );
    await waitFor(() => assert.equal(titles().length, 4));
    assert.deepEqual(titles(), [
      "Before — desktop — light",
      "Current — desktop — light",
      "Before — desktop — dark · Light only",
      "Current — desktop — dark · Light only",
    ]);
  } finally {
    view.unmount();
  }
});
