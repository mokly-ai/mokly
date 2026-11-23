/**
 * The failures of the compare on the canvas: a row's own failure stays on
 * that row's frames while the other rows compare, and only a failure of every
 * drawn row covers the canvas, whose Try again requests every row again. A
 * row's Try again moves focus to the stage, which shows the row's load.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";

import type { CanvasSectionFrame } from "@mokly/ui/canvas-section";

import { ComparisonCanvas } from "../src/shell/comparison_canvas.js";
import { useCanvasComparison } from "../src/shell/comparison_canvas_context.js";
import type { ComparisonEnvironment } from "../src/shell/comparison_context.js";
import type { ComparisonFramePlan } from "../src/shell/comparison_rows.js";
import { comparedFrames } from "../src/shell/comparison_selection.js";
import type {
  ComparisonController,
  ComparisonGenerations,
} from "../src/shell/use_comparison.js";

import {
  ACTION,
  generationRoot,
  ORIGIN,
  OUTLINE,
} from "./comparison_lifecycle_harness.js";
import { flush } from "./data_fakes.js";
import { ShellStoreFixture } from "./shell_markup.js";

const UNAVAILABLE = "The comparison is unavailable.";

/** The Light frame of one row of the variant set. */
function plan(path: string, row: number): ComparisonFramePlan {
  return {
    column: 0,
    entry: { path },
    key: `${path}:light`,
    kind: "component",
    label: `${path} · Light`,
    name: `${path} · Light`,
    row,
    scheme: "light",
    viewport: "desktop",
  };
}

const PLANS = [plan(ACTION, 0), plan(OUTLINE, 1)];

/** The live frames that the workspace's canvas gives the compare. */
const LIVE: readonly CanvasSectionFrame[] = PLANS.map(({ key, row }) => ({
  column: 0,
  height: 800,
  key,
  node: null,
  row,
  width: 1280,
}));

/**
 * The keys of the frames that the canvas shows, as the compare gives them,
 * and the cell of the shown frame whose key is `drawn`.
 */
function Probe({ drawn }: { drawn: string | undefined }) {
  const comparison = useCanvasComparison();
  const frames = comparison ? comparison.frames(LIVE) : LIVE;
  const shown = frames.filter((frame) => !frame.hidden);
  return (
    <>
      <p data-testid="frames">{shown.map((frame) => frame.key).join()}</p>
      {shown.find((frame) => frame.key === drawn)?.node}
    </>
  );
}

/** The changed Light view of each row. */
function rows(entry: string) {
  return {
    compared: {
      basePath: entry,
      path: entry,
      reasons: [],
      views: [
        {
          colorScheme: "light" as const,
          ignoredIds: [],
          state: "changed" as const,
          viewport: "desktop" as const,
        },
      ],
    },
    usingChanged: new Set<string>(),
  };
}

/** An Overlay comparison whose routed row, Outline, failed. */
function controller(
  generations: ComparisonGenerations,
  calls: string[],
): ComparisonController {
  return {
    busy: false,
    failure: UNAVAILABLE,
    generations,
    mode: "overlay",
    presentation: {
      colorScheme: "light",
      mode: "overlay",
      requestedColorScheme: "light",
      viewport: "both",
    },
    refresh: () => calls.push("refresh"),
    retry: (entry) => calls.push(`retry ${String(entry)}`),
    selectMode: () => undefined,
  };
}

/** A host whose snapshot documents wait for the test. */
function documentHost() {
  const answers: (() => void)[] = [];
  const environment: ComparisonEnvironment = {
    baseUrl: ORIGIN,
    delivery: () => ({ kind: "live" }),
    fetch: (input) =>
      new Promise<Response>((resolve) =>
        answers.push(() => {
          const response = new Response("<!doctype html><p>Version</p>", {
            headers: { "content-type": "text/html" },
          });
          Object.defineProperty(response, "url", { value: String(input) });
          resolve(response);
        }),
      ),
  };
  return { answers, environment };
}

/** The compare on the canvas, which draws the cell of `drawn` by its key. */
function compare(
  comparison: ComparisonController,
  environment: ComparisonEnvironment,
  drawn?: string,
): ReactNode {
  const generations = comparison.generations ?? new Map();
  return (
    <ShellStoreFixture comparisonEnvironment={environment}>
      <ComparisonCanvas
        comparison={comparison}
        entryId={OUTLINE}
        entryKind="component"
        frames={comparedFrames(PLANS, generations, rows)}
        plans={new Map(PLANS.map((each) => [each.key, each]))}
        sideKey={undefined}
      >
        <Probe drawn={drawn} />
      </ComparisonCanvas>
    </ShellStoreFixture>
  );
}

test("a row's failure stays on its own frames, and only every row's failure covers the canvas with Try again for every row", async (t) => {
  GlobalRegistrator.register();
  t.after(() => GlobalRegistrator.unregister());
  const host = documentHost();
  const calls: string[] = [];
  const partly = Object.assign(
    new Map([[ACTION, { url: generationRoot("a") }]]),
    {
      failures: new Map([[OUTLINE, UNAVAILABLE]]),
    },
  );
  const view = render(compare(controller(partly, calls), host.environment));
  try {
    await act(async () => {
      for (const answer of host.answers) answer();
      await flush();
    });
    assert.equal(
      view.queryAllByText("The comparison could not be loaded.").length,
      0,
    );
    assert.equal(
      view.getByTestId("frames").textContent,
      `compare:${ACTION}:light,compare:${OUTLINE}:light`,
    );
    const failed = Object.assign(new Map(), {
      failures: new Map([
        [ACTION, UNAVAILABLE],
        [OUTLINE, UNAVAILABLE],
      ]),
    });
    view.rerender(compare(controller(failed, calls), host.environment));
    const tryAgain = view.queryByRole("button", { name: "Try again" });
    assert.ok(tryAgain);
    await act(async () => tryAgain.click());
    assert.deepEqual(calls, ["refresh"]);
  } finally {
    view.unmount();
  }
});

test("a failed row's Try again moves focus to the comparison stage, which holds the row's load in place of the button", async (t) => {
  GlobalRegistrator.register();
  t.after(() => GlobalRegistrator.unregister());
  const host = documentHost();
  const calls: string[] = [];
  const loaded = { url: generationRoot("a") };
  const failed = Object.assign(new Map([[ACTION, loaded]]), {
    failures: new Map([[OUTLINE, UNAVAILABLE]]),
  });
  const cell = `compare:${OUTLINE}:light`;
  const view = render(
    compare(controller(failed, calls), host.environment, cell),
  );
  try {
    await act(async () => {
      for (const answer of host.answers) answer();
      await flush();
    });
    const tryAgain = view.getByRole("button", { name: "Try again" });
    tryAgain.focus();
    await act(async () => tryAgain.click());
    assert.deepEqual(calls, [`retry ${OUTLINE}`]);
    // The row waits for its next generation, so the canvas shows its load.
    const retrying = Object.assign(new Map([[ACTION, loaded]]), {
      pending: new Set([OUTLINE]),
    });
    view.rerender(compare(controller(retrying, calls), host.environment, cell));
    assert.equal(
      view.container.querySelector("[data-diff-stage]")?.textContent,
      "Loading comparison…",
    );
    // The stage names its entry. The message of a failed comparison of two
    // elements would print the whole document.
    assert.equal(
      document.activeElement?.getAttribute("data-diff-screen"),
      OUTLINE,
    );
  } finally {
    view.unmount();
  }
});
