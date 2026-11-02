import assert from "node:assert/strict";
import test from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, renderHook } from "@testing-library/react";

import {
  ComparisonEnvironmentProvider,
  type ComparisonEnvironment,
} from "../src/shell/comparison_context.js";
import { useComparison } from "../src/shell/use_comparison.js";

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
          entryId: "home",
        }),
      {
        wrapper: ({ children }) => (
          <ComparisonEnvironmentProvider environment={environment}>
            {children}
          </ComparisonEnvironmentProvider>
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
