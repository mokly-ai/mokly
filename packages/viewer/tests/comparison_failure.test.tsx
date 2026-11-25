import assert from "node:assert/strict";
import test from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, renderHook } from "@testing-library/react";

import type { ComparisonEnvironment } from "../src/shell/comparison_context.js";
import { useComparison } from "../src/shell/use_comparison.js";

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
import { unregisterDom } from "./dom_teardown.js";
import { ShellStoreFixture } from "./shell_markup.js";

/** The routed screen whose comparison the workspace requests. */
const HOME = "product/browse/home";

test("a comparison network failure keeps browser text out of its details in every host", async (t) => {
  GlobalRegistrator.register();
  t.after(unregisterDom);
  for (const embedded of [false, true]) {
    const reported: unknown[] = [];
    const error = new TypeError("Failed to fetch");
    const environment: ComparisonEnvironment = {
      baseUrl: "https://catalogue.test",
      delivery: () => ({ kind: "live" }),
      fetch: async () => {
        throw error;
      },
      ...(embedded
        ? { reportError: (value: unknown) => reported.push(value) }
        : {}),
    };
    const { result, unmount } = renderHook(
      () =>
        useComparison({
          eligible: true,
          eligibilityKnown: true,
          entryId: HOME,
        }),
      {
        wrapper: ({ children }) => (
          <ShellStoreFixture
            comparisonEnvironment={environment}
            path={`/view/${HOME}/`}
          >
            {children}
          </ShellStoreFixture>
        ),
      },
    );
    try {
      await act(async () => result.current.selectMode("side"));
      assert.equal(result.current.failure, "The comparison is unavailable.");
      assert.equal(result.current.busy, false);
      assert.equal(result.current.loaded, undefined);
      assert.deepEqual(reported, embedded ? [error] : []);
    } finally {
      unmount();
    }
  }
});

test("a failed row reports its own failure while the other rows still compare", async (t) => {
  GlobalRegistrator.register();
  t.after(unregisterDom);
  const host = heldHost();
  const props = {
    eligible: true,
    eligibilityKnown: true,
    entryId: DEFAULT,
    frames: [
      frame(ACTION, "light"),
      frame(OUTLINE, "light"),
      frame(DEFAULT, "light"),
    ],
    owner: ACTION,
  };
  const view = renderComparison(host.environment, props);
  const outline = new TypeError("Failed to fetch");
  const routed = new TypeError("Load failed");
  try {
    await act(async () => view.result.current.selectMode("overlay"));
    assert.deepEqual(host.labels(), [
      `GET ${ACTION}`,
      `GET ${OUTLINE}`,
      `GET ${DEFAULT}`,
    ]);
    await act(async () => {
      host.requests[0]!.answer(generationRoot("action-1"));
      host.requests[1]!.fail(outline);
      await flush();
    });
    let { busy, failure, generations } = view.result.current;
    assert.deepEqual(
      [...(generations ?? [])],
      [[ACTION, { url: generationRoot("action-1") }]],
    );
    assert.deepEqual(
      [...(generations?.failures ?? [])],
      [[OUTLINE, "The comparison is unavailable."]],
    );
    assert.equal(failure, undefined);
    assert.equal(busy, true);
    await act(async () => {
      host.requests[2]!.fail(routed);
      await flush();
    });
    ({ busy, failure, generations } = view.result.current);
    assert.equal(failure, "The comparison is unavailable.");
    assert.equal(busy, false);
    assert.deepEqual(
      [...(generations?.failures ?? [])],
      [
        [OUTLINE, "The comparison is unavailable."],
        [DEFAULT, "The comparison is unavailable."],
      ],
    );
    // A failed row keeps its failure for its key without another request.
    view.rerender({ ...props });
    assert.equal(host.requests.length, 3);
    assert.deepEqual(host.reported, [outline, routed]);
  } finally {
    view.unmount();
  }
});
