/**
 * What the canvas holds while a compare mode shows, under the comparison
 * panes lifecycle: it loads until every demanded row has a generation, so it
 * never shows a part of the comparison and then loads again.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { canvasCompareState } from "../src/shell/comparison_canvas_state.js";
import type { ComparisonDocumentsState } from "../src/shell/comparison_documents.js";

import {
  ACTION,
  generationRoot,
  OUTLINE,
} from "./comparison_lifecycle_harness.js";

const ACTION_GENERATION = { url: generationRoot("action-1") };
const READY: ComparisonDocumentsState = {
  presentations: new Map(),
  status: "ready",
};

test("a demanded row that waits without a generation keeps the canvas loading", () => {
  const drawn = [{ entry: ACTION }];
  const rows = new Map([[ACTION, READY]]);
  // Overlay waits for the row whose first request still runs.
  assert.deepEqual(
    canvasCompareState({
      frames: drawn,
      generations: Object.assign(new Map([[ACTION, ACTION_GENERATION]]), {
        pending: new Set([OUTLINE]),
      }),
      mode: "overlay",
      rows,
    }),
    { status: "loading" },
  );
  // Side by side on that row has no frame to draw yet.
  assert.deepEqual(
    canvasCompareState({
      frames: [],
      generations: Object.assign(new Map(), { pending: new Set([OUTLINE]) }),
      mode: "side",
      rows: new Map(),
    }),
    { status: "loading" },
  );
  // A row that renews keeps its generation, so its frames still show.
  assert.deepEqual(
    canvasCompareState({
      frames: drawn,
      generations: Object.assign(new Map([[ACTION, ACTION_GENERATION]]), {
        pending: new Set([ACTION]),
      }),
      mode: "overlay",
      rows,
    }),
    { mode: "overlay", status: "ready" },
  );
});
