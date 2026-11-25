/**
 * The renewal of each compared row in live delivery, under the selected
 * comparisons contract: a row renews its own generation before its new panes
 * load, and a row that leaves the comparison keeps its generation for its
 * return.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act } from "@testing-library/react";

import type { ComparisonOptions } from "../src/shell/use_comparison.js";

import {
  ACTION,
  frame,
  generationRoot,
  heldHost,
  OUTLINE,
  renderComparison,
} from "./comparison_lifecycle_harness.js";
import { flush } from "./data_fakes.js";
import { unregisterDom } from "./dom_teardown.js";

/** Both rows of the variant set, with the Dark frame of the component's own row. */
const BOTH = [
  frame(ACTION, "light"),
  frame(ACTION, "dark"),
  frame(OUTLINE, "light"),
];

test("a row's frames renew that row alone, a mode switch renews each row, and another generation reacquires its row alone", async (t) => {
  GlobalRegistrator.register();
  t.after(unregisterDom);
  const host = heldHost();
  const props: ComparisonOptions = {
    eligible: true,
    eligibilityKnown: true,
    entryId: ACTION,
    frames: BOTH,
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
    const action = view.result.current.generations?.get(ACTION);
    // The Frames filter hides the component's Dark frame.
    view.rerender({
      ...props,
      frames: [frame(ACTION, "light"), frame(OUTLINE, "light")],
    });
    assert.deepEqual(host.labels().slice(2), ["HEAD action-1"]);
    assert.deepEqual(
      [...(view.result.current.generations?.pending ?? [])],
      [ACTION],
    );
    assert.equal(view.result.current.busy, true);
    await act(async () => {
      host.requests[2]!.answer(generationRoot("action-1"));
      await flush();
    });
    assert.equal(view.result.current.busy, false);
    await act(async () => view.result.current.selectMode("difference"));
    assert.deepEqual(host.labels().slice(3), [
      "HEAD action-1",
      "HEAD outline-1",
    ]);
    // A later switch shares the pending renewals and waits for them.
    await act(async () => view.result.current.selectMode("swipe"));
    assert.equal(host.requests.length, 5);
    assert.equal(view.result.current.presentation?.mode, "overlay");
    await act(async () => {
      host.requests[3]!.answer(generationRoot("action-1"));
      host.requests[4]!.answer(generationRoot("outline-2"));
      await flush();
    });
    // Only the row whose generation is gone requests a selection again.
    assert.deepEqual(host.labels().slice(5), [`GET ${OUTLINE}`]);
    assert.equal(view.result.current.presentation?.mode, "overlay");
    await act(async () => {
      host.requests[5]!.answer(generationRoot("outline-2"));
      await flush();
    });
    const { generations, presentation } = view.result.current;
    assert.equal(generations?.get(ACTION), action);
    assert.deepEqual(generations?.get(OUTLINE), {
      url: generationRoot("outline-2"),
    });
    assert.equal(presentation?.mode, "swipe");
    assert.equal(host.requests.length, 6);
  } finally {
    view.unmount();
  }
});

test("a row that leaves the comparison returns at once and renews before its panes load", async (t) => {
  GlobalRegistrator.register();
  t.after(unregisterDom);
  const host = heldHost();
  const props: ComparisonOptions = {
    comparedFrame: `${ACTION}:light`,
    eligible: true,
    eligibilityKnown: true,
    entryId: ACTION,
    frames: BOTH,
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
    const outline = view.result.current.generations?.get(OUTLINE);
    await act(async () => view.result.current.selectMode("side"));
    assert.deepEqual(host.labels().slice(2), ["HEAD action-1"]);
    assert.equal(view.result.current.generations?.has(OUTLINE), false);
    await act(async () => {
      host.requests[2]!.answer(generationRoot("action-1"));
      await flush();
    });
    await act(async () => view.result.current.selectMode("overlay"));
    const { generations } = view.result.current;
    assert.equal(generations?.get(OUTLINE), outline);
    assert.deepEqual([...(generations?.pending ?? [])], [ACTION, OUTLINE]);
    assert.deepEqual(host.labels().slice(3), [
      "HEAD action-1",
      "HEAD outline-1",
    ]);
  } finally {
    view.unmount();
  }
});
