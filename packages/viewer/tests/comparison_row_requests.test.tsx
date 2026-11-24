/**
 * The requests of the compared rows under the selected comparisons contract:
 * one selection for each row that the comparison demands, Side by side's one
 * row, Try again for one row and Refresh for every row.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act } from "@testing-library/react";

import type { ComparisonOptions } from "../src/shell/use_comparison.js";

import {
  ACTION,
  DEFAULT,
  frame,
  generationRoot,
  heldHost,
  OUTLINE,
  renderComparison,
} from "./comparison_lifecycle_harness.js";
import { flush } from "./data_fakes.js";

test("each compared row gets one selection request, and a row outside the frames gets none", async (t) => {
  GlobalRegistrator.register();
  t.after(() => GlobalRegistrator.unregister());
  const host = heldHost();
  // The routed saved variant does not compare, so the frames leave it out.
  const props: ComparisonOptions = {
    eligible: true,
    eligibilityKnown: true,
    entryId: DEFAULT,
    frames: [
      frame(ACTION, "light"),
      frame(ACTION, "dark"),
      frame(OUTLINE, "light"),
    ],
    owner: ACTION,
  };
  const view = renderComparison(host.environment, props);
  try {
    await act(async () => view.result.current.selectMode("overlay"));
    assert.deepEqual(host.labels(), [`GET ${ACTION}`, `GET ${OUTLINE}`]);
    await act(async () => {
      host.requests[0]!.answer(generationRoot("action-1"));
      host.requests[1]!.answer(generationRoot("outline-1"));
      await flush();
    });
    const { busy, generations, loaded, presentation } = view.result.current;
    assert.deepEqual(
      [...(generations ?? [])],
      [
        [ACTION, { url: generationRoot("action-1") }],
        [OUTLINE, { url: generationRoot("outline-1") }],
      ],
    );
    assert.equal(loaded, undefined);
    assert.equal(busy, false);
    assert.equal(presentation?.mode, "overlay");
    // No shown frame compares, so the comparison demands no row.
    view.rerender({ ...props, frames: [] });
    assert.equal(view.result.current.generations, undefined);
    assert.equal(host.requests.length, 2);
  } finally {
    view.unmount();
  }
});

test("Side by side requests the compared frame's row alone, and another compared row aborts the earlier request", async (t) => {
  GlobalRegistrator.register();
  t.after(() => GlobalRegistrator.unregister());
  const host = heldHost();
  // Without a chosen frame, Side by side compares the routed row's first frame.
  const props: ComparisonOptions = {
    eligible: true,
    eligibilityKnown: true,
    entryId: OUTLINE,
    frames: [
      frame(ACTION, "light"),
      frame(ACTION, "dark"),
      frame(OUTLINE, "light"),
    ],
    owner: ACTION,
  };
  const view = renderComparison(host.environment, props);
  try {
    await act(async () => view.result.current.selectMode("side"));
    assert.deepEqual(host.labels(), [`GET ${OUTLINE}`]);
    view.rerender({ ...props, comparedFrame: `${ACTION}:dark` });
    assert.deepEqual(host.labels(), [`GET ${OUTLINE}`, `GET ${ACTION}`]);
    assert.deepEqual(
      host.requests.map(({ signal }) => signal.aborted),
      [true, false],
    );
    await act(async () => {
      // The late response of the row that left changes nothing.
      host.requests[0]!.answer(generationRoot("outline-1"));
      host.requests[1]!.answer(generationRoot("action-1"));
      await flush();
    });
    assert.deepEqual(
      [...(view.result.current.generations ?? [])],
      [[ACTION, { url: generationRoot("action-1") }]],
    );
    assert.equal(view.result.current.presentation?.mode, "side");
    // A frame that the frames do not hold, on a routed row without frames,
    // gives way to the first frame: its row renews for its Light frame.
    view.rerender({ ...props, comparedFrame: "missing", entryId: DEFAULT });
    assert.deepEqual(host.labels().slice(2), ["HEAD action-1"]);
  } finally {
    view.unmount();
  }
});

test("Try again requests its own row with refresh, the routed row by default, and Refresh requests every row", async (t) => {
  GlobalRegistrator.register();
  t.after(() => GlobalRegistrator.unregister());
  const host = heldHost();
  const view = renderComparison(host.environment, {
    eligible: true,
    eligibilityKnown: true,
    entryId: OUTLINE,
    frames: [frame(ACTION, "light"), frame(OUTLINE, "light")],
    owner: ACTION,
  });
  try {
    await act(async () => view.result.current.selectMode("overlay"));
    assert.deepEqual(host.labels(), [`GET ${ACTION}`, `GET ${OUTLINE}`]);
    await act(async () => {
      host.requests[0]!.answer(generationRoot("action-1"));
      host.requests[1]!.answer(generationRoot("outline-1"));
      await flush();
    });
    await act(async () => view.result.current.retry(ACTION));
    assert.deepEqual(host.labels().slice(2), [`GET ${ACTION} refresh`]);
    // The package's failure state passes its click event, which names no row.
    const onRetry: () => void = view.result.current.retry;
    const click: (event: Event) => void = onRetry;
    await act(async () => click(new Event("click")));
    assert.deepEqual(host.labels().slice(3), [`GET ${OUTLINE} refresh`]);
    await act(async () => view.result.current.refresh());
    assert.deepEqual(host.labels().slice(4), [
      `GET ${ACTION} refresh`,
      `GET ${OUTLINE} refresh`,
    ]);
    // Refresh takes over each row's earlier Try again.
    assert.deepEqual(
      host.requests.map(({ signal }) => signal.aborted),
      [false, false, true, true, false, false],
    );
    await act(async () => {
      // The late response of a replaced Try again changes nothing.
      host.requests[2]!.answer(generationRoot("action-2"));
      host.requests[4]!.answer(generationRoot("action-3"));
      host.requests[5]!.answer(generationRoot("outline-3"));
      await flush();
    });
    assert.deepEqual(
      [...(view.result.current.generations ?? [])],
      [
        [ACTION, { url: generationRoot("action-3") }],
        [OUTLINE, { url: generationRoot("outline-3") }],
      ],
    );
  } finally {
    view.unmount();
  }
});
