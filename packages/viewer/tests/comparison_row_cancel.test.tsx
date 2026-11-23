/**
 * Cancellation and navigation of the compared rows, under the selected
 * comparisons contract: Current and another workspace cancel every row, and
 * navigation between the entries of one variant set keeps every row.
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

const HOME = "product/browse/home";

test("Current aborts every row's request, and a late response changes nothing", async (t) => {
  GlobalRegistrator.register();
  t.after(() => GlobalRegistrator.unregister());
  const host = heldHost();
  const view = renderComparison(host.environment, {
    eligible: true,
    eligibilityKnown: true,
    entryId: ACTION,
    frames: [frame(ACTION, "light"), frame(OUTLINE, "light")],
    owner: ACTION,
  });
  try {
    await act(async () => view.result.current.selectMode("overlay"));
    await act(async () => view.result.current.selectMode("current"));
    assert.deepEqual(
      host.requests.map(({ signal }) => signal.aborted),
      [true, true],
    );
    await act(async () => {
      host.requests[0]!.answer(generationRoot("action-1"));
      host.requests[1]!.answer(generationRoot("outline-1"));
      await flush();
    });
    const { busy, generations, loaded, presentation } = view.result.current;
    assert.deepEqual(
      { busy, generations, loaded, presentation },
      {
        busy: false,
        generations: undefined,
        loaded: undefined,
        presentation: undefined,
      },
    );
  } finally {
    view.unmount();
  }
});

test("navigation in the variant set and a scheme change keep every row, and another workspace aborts every row", async (t) => {
  GlobalRegistrator.register();
  t.after(() => GlobalRegistrator.unregister());
  const host = heldHost();
  const props: ComparisonOptions = {
    eligible: true,
    eligibilityKnown: true,
    entryId: ACTION,
    frames: [frame(ACTION, "light"), frame(OUTLINE, "light")],
    owner: ACTION,
  };
  const view = renderComparison(host.environment, props);
  try {
    await act(async () => view.result.current.selectMode("overlay"));
    assert.deepEqual(host.labels(), [`GET ${ACTION}`, `GET ${OUTLINE}`]);
    await act(async () => {
      host.requests[0]!.answer(generationRoot("action-1"));
      host.requests[1]!.fail(new TypeError("Failed to fetch"));
      await flush();
    });
    const { generations } = view.result.current;
    assert.deepEqual(view.result.current.loaded, {
      url: generationRoot("action-1"),
    });
    assert.equal(view.result.current.failure, undefined);
    // The saved variant's route keeps the component's workspace.
    view.rerender({ ...props, entryId: OUTLINE });
    assert.equal(view.result.current.generations, generations);
    assert.equal(view.result.current.loaded, undefined);
    assert.equal(view.result.current.failure, "The comparison is unavailable.");
    // The shown scheme changes no row's frames: it is shown at once.
    view.rerender({ ...props, effectiveColorScheme: "dark", entryId: OUTLINE });
    assert.equal(view.result.current.generations, generations);
    assert.equal(view.result.current.presentation?.colorScheme, "dark");
    assert.equal(host.requests.length, 2);
    // The mode renews the loaded row and requests the failed row again.
    await act(async () => view.result.current.selectMode("difference"));
    assert.deepEqual(host.labels().slice(2), [
      "HEAD action-1",
      `GET ${OUTLINE}`,
    ]);
    view.rerender({ ...props, entryId: HOME, owner: HOME });
    assert.deepEqual(
      host.requests.slice(2).map(({ signal }) => signal.aborted),
      [true, true],
    );
    await act(async () => {
      host.requests[2]!.answer(generationRoot("action-1"));
      host.requests[3]!.answer(generationRoot("outline-1"));
      await flush();
    });
    const { busy, failure, loaded, presentation } = view.result.current;
    assert.deepEqual(
      {
        busy,
        failure,
        generations: view.result.current.generations,
        loaded,
        presentation,
      },
      {
        busy: false,
        failure: undefined,
        generations: undefined,
        loaded: undefined,
        presentation: undefined,
      },
    );
    assert.equal(host.requests.length, 4);
  } finally {
    view.unmount();
  }
});
