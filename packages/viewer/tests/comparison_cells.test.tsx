/**
 * The cells of the compare on the canvas: a compared frame whose row could
 * not be loaded draws the failure in its place, and its Try again requests
 * that row again.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, render } from "@testing-library/react";

import { comparisonSectionFrames } from "../src/shell/comparison_cells.js";
import { createComparisonScrollSync } from "../src/shell/comparison_scroll_sync.js";
import type { ComparedFrame } from "../src/shell/comparison_selection.js";
import { entryWording } from "../src/shell/entry_wording.js";

import { OUTLINE } from "./comparison_lifecycle_harness.js";

const KEY = `${OUTLINE}:light`;

/** The Light frame of a row whose comparison request failed. */
const FAILED: ComparedFrame = {
  componentsOnly: false,
  documents: {},
  entry: OUTLINE,
  key: KEY,
  lightOnly: false,
  styleOnly: false,
  view: {
    colorScheme: "light",
    ignoredIds: [],
    state: "changed",
    viewport: "desktop",
  },
};

test("Try again on a failed row's frame requests that row again", async (t) => {
  GlobalRegistrator.register();
  t.after(() => GlobalRegistrator.unregister());
  const retried: unknown[] = [];
  const cells = comparisonSectionFrames(
    {
      frames: [
        {
          cell: {
            column: 0,
            kind: "component",
            label: "Outline · Light",
            name: "Outline · Light",
            row: 0,
            scheme: "light",
            size: { height: 800, width: 1280 },
          },
          frame: FAILED,
          state: {
            message: "The comparison is unavailable.",
            status: "failed",
          },
        },
      ],
      mode: "overlay",
      onSplit: () => undefined,
      retry: (entry) => retried.push(entry),
      sideKey: undefined,
      split: 50,
      sync: () => createComparisonScrollSync(),
      wording: entryWording("component"),
    },
    [{ column: 0, height: 800, key: KEY, node: null, row: 0, width: 1280 }],
  );
  const failed = cells.find((cell) => !cell.hidden);
  const view = render(<>{failed?.node}</>);
  try {
    await act(async () =>
      view.getByRole("button", { name: "Try again" }).click(),
    );
    assert.deepEqual(retried, [OUTLINE]);
  } finally {
    view.unmount();
  }
});
