/**
 * The compared rows of a static build and a React host, under the static
 * comparisons contract: every row reads the packaged generation, and the
 * shell checks the deployment once for each change, not once for each row.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act } from "@testing-library/react";

import {
  ACTION,
  frame,
  heldHost,
  OUTLINE,
  pinnedDelivery,
  renderComparison,
} from "./comparison_lifecycle_harness.js";
import { flush } from "./data_fakes.js";

/** Deployment checks that wait for the test's answer. */
function heldChecks() {
  const checks: { resolve(same: boolean): void; signal: AbortSignal }[] = [];
  return {
    check: (signal: AbortSignal) =>
      new Promise<boolean>((resolve) => checks.push({ resolve, signal })),
    checks,
  };
}

test("a static comparison checks the deployment once for the rows that start together and gives each row the packaged root", async (t) => {
  GlobalRegistrator.register();
  t.after(() => GlobalRegistrator.unregister());
  const { delivery, root } = pinnedDelivery();
  const { check, checks } = heldChecks();
  const host = heldHost(delivery, check);
  const view = renderComparison(host.environment, {
    eligible: true,
    eligibilityKnown: true,
    entryId: ACTION,
    frames: [frame(ACTION, "light"), frame(OUTLINE, "light")],
    owner: ACTION,
  });
  try {
    await act(async () => view.result.current.selectMode("overlay"));
    assert.equal(checks.length, 1);
    await act(async () => {
      checks[0]!.resolve(true);
      await flush();
    });
    const { generations } = view.result.current;
    assert.deepEqual(
      [...(generations ?? [])],
      [
        [ACTION, { url: root }],
        [OUTLINE, { url: root }],
      ],
    );
    await act(async () => view.result.current.selectMode("difference"));
    assert.equal(checks.length, 2);
    await act(async () => {
      checks[1]!.resolve(true);
      await flush();
    });
    assert.equal(view.result.current.presentation?.mode, "difference");
    assert.equal(view.result.current.busy, false);
    assert.deepEqual(host.labels(), []);
  } finally {
    view.unmount();
  }
});

test("a row's own cancel keeps the deployment check of the other rows, and another deployment ends the check with no failure", async (t) => {
  GlobalRegistrator.register();
  t.after(() => GlobalRegistrator.unregister());
  const { delivery, root } = pinnedDelivery();
  const { check, checks } = heldChecks();
  const host = heldHost(delivery, check);
  const view = renderComparison(host.environment, {
    comparedFrame: `${ACTION}:light`,
    eligible: true,
    eligibilityKnown: true,
    entryId: ACTION,
    frames: [frame(ACTION, "light"), frame(OUTLINE, "light")],
    owner: ACTION,
  });
  try {
    await act(async () => view.result.current.selectMode("overlay"));
    assert.equal(checks.length, 1);
    assert.deepEqual(
      [...(view.result.current.generations?.pending ?? [])],
      [ACTION, OUTLINE],
    );
    // Side by side drops the other row while the check still runs.
    await act(async () => view.result.current.selectMode("side"));
    assert.equal(checks.length, 1);
    assert.equal(checks[0]!.signal.aborted, false);
    await act(async () => {
      checks[0]!.resolve(true);
      await flush();
    });
    assert.deepEqual(
      [...(view.result.current.generations ?? [])],
      [[ACTION, { url: root }]],
    );
    assert.equal(view.result.current.presentation?.mode, "side");
    await act(async () => view.result.current.refresh());
    await act(async () => {
      checks[1]!.resolve(false);
      await flush();
    });
    const { busy, failure, generations } = view.result.current;
    assert.equal(busy, false);
    assert.equal(failure, undefined);
    assert.equal(generations?.failures?.size ?? 0, 0);
    assert.deepEqual(host.reported, []);
    assert.equal(checks.length, 2);
  } finally {
    view.unmount();
  }
});
