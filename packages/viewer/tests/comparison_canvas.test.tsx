/**
 * The compare on the canvas: what the canvas holds while a compare mode
 * loads, the line of an entry without a comparison, and the `shown` gate,
 * which keeps the mode, the loaded comparison and its presentations while
 * the canvas shows its live frames.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import type { CanvasSectionFrame } from "@mokly/ui/canvas-section";

import { ComparisonCanvas } from "../src/shell/comparison_canvas.js";
import { useCanvasComparison } from "../src/shell/comparison_canvas_context.js";
import type { ComparisonEnvironment } from "../src/shell/comparison_context.js";
import type { ComparisonFramePlan } from "../src/shell/comparison_rows.js";
import {
  comparedFrames,
  type ComparedFrame,
} from "../src/shell/comparison_selection.js";
import type { ComparisonController } from "../src/shell/use_comparison.js";

import { ShellStoreFixture } from "./shell_markup.js";

const ORIGIN = "https://catalogue.test";
const ROOT = `${ORIGIN}/mokly-viewer/diffs/generations/one/`;
const HOME = "product/browse/home";

/** The live frame that the workspace's canvas gives the compare. */
const LIVE: readonly CanvasSectionFrame[] = [
  {
    column: 0,
    height: 800,
    key: "desktop-light",
    node: null,
    row: 0,
    width: 1280,
  },
];

const PLAN: ComparisonFramePlan = {
  column: 0,
  entry: { path: HOME },
  key: "desktop-light",
  kind: "desktop",
  label: "Desktop · Light",
  name: "Desktop · Light",
  row: 0,
  scheme: "light",
  viewport: "desktop",
};

/** The keys of the frames that the canvas shows, as the compare gives them. */
function Probe() {
  const comparison = useCanvasComparison();
  const frames = comparison ? comparison.frames(LIVE) : LIVE;
  const shown = frames.filter((frame) => !frame.hidden);
  return <p data-testid="frames">{shown.map((frame) => frame.key).join()}</p>;
}

/** A loaded Overlay comparison of Home, or one whose request is pending. */
function controller(loaded: boolean): ComparisonController {
  const generation = { url: ROOT };
  return {
    busy: !loaded,
    mode: "overlay",
    refresh: () => undefined,
    retry: () => undefined,
    selectMode: () => undefined,
    ...(loaded
      ? {
          generations: new Map([[HOME, generation]]),
          loaded: generation,
          presentation: {
            colorScheme: "light",
            mode: "overlay",
            requestedColorScheme: "light",
            viewport: "both",
          },
        }
      : {}),
  };
}

/** Home's Desktop · Light frame, compared in the loaded generation. */
function homeFrames(): ComparedFrame[] {
  return comparedFrames([PLAN], new Map([[HOME, { url: ROOT }]]), () => ({
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
  }));
}

/** An environment that answers every snapshot with a document. */
function environment(fetched: string[]): ComparisonEnvironment {
  return {
    baseUrl: ORIGIN,
    delivery: () => ({ kind: "live" }),
    fetch: async (input) => {
      fetched.push(String(input));
      const response = new Response("<!doctype html><p>Version</p>", {
        headers: { "content-type": "text/html" },
      });
      Object.defineProperty(response, "url", { value: String(input) });
      return response;
    },
  };
}

function compare(
  props: {
    comparison: ComparisonController;
    entryKind?: "component" | "screen";
    frames: readonly ComparedFrame[];
    shown?: boolean;
  },
  host: ComparisonEnvironment,
): ReactNode {
  return (
    <ShellStoreFixture comparisonEnvironment={host} path={`/view/${HOME}/`}>
      <ComparisonCanvas
        comparison={props.comparison}
        entryId={HOME}
        entryKind={props.entryKind ?? "screen"}
        frames={props.frames}
        plans={new Map([[PLAN.key, PLAN]])}
        sideKey={undefined}
        {...(props.shown === undefined ? {} : { shown: props.shown })}
      >
        <Probe />
      </ComparisonCanvas>
    </ShellStoreFixture>
  );
}

test("the shown gate keeps the loaded comparison and its presentations while the canvas shows its live frames", async (t) => {
  GlobalRegistrator.register();
  t.after(() => GlobalRegistrator.unregister());
  const fetched: string[] = [];
  const host = environment(fetched);
  const frames = homeFrames();
  const comparison = controller(true);
  const view = render(compare({ comparison, frames }, host));
  try {
    await waitFor(() =>
      assert.equal(
        view.getByTestId("frames").textContent,
        "compare:desktop-light",
      ),
    );
    assert.deepEqual(fetched, [
      `${ROOT}snapshots/before/mokly-generated/${HOME}/index.desktop.html`,
      `${ROOT}snapshots/after/mokly-generated/${HOME}/index.desktop.html`,
    ]);
    view.rerender(compare({ comparison, frames, shown: false }, host));
    assert.equal(view.getByTestId("frames").textContent, "desktop-light");
    view.rerender(compare({ comparison, frames, shown: true }, host));
    assert.equal(
      view.getByTestId("frames").textContent,
      "compare:desktop-light",
    );
    assert.equal(fetched.length, 2);
  } finally {
    view.unmount();
  }
});

test("the canvas holds the loading line, then the line of an entry without a comparison", async (t) => {
  GlobalRegistrator.register();
  t.after(() => GlobalRegistrator.unregister());
  const fetched: string[] = [];
  const host = environment(fetched);
  const view = render(
    compare({ comparison: controller(false), frames: [] }, host),
  );
  try {
    assert.ok(view.getByText("Loading comparison…"));
    for (const [kind, line] of [
      ["component", "This variant has no comparison available."],
      ["screen", "This screen has no comparison available."],
    ] as const) {
      view.rerender(
        compare(
          { comparison: controller(true), entryKind: kind, frames: [] },
          host,
        ),
      );
      assert.ok(view.getByText(line));
    }
    assert.deepEqual(fetched, []);
  } finally {
    view.unmount();
  }
});
