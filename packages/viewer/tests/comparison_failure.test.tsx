import assert from "node:assert/strict";
import test from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, renderHook } from "@testing-library/react";

import type { ComparisonEnvironment } from "../src/shell/comparison_context.js";
import { useComparison } from "../src/shell/use_comparison.js";

import { ShellStoreFixture } from "./shell_markup.js";

/** The routed screen whose comparison the workspace requests. */
const HOME = "product/browse/home";

test("a comparison network failure keeps browser text out of its details in every host", async (t) => {
  GlobalRegistrator.register();
  t.after(() => GlobalRegistrator.unregister());
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
