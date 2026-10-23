import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import { addComparisonFixtureSources } from "../helpers/additional_comparison_sources.js";
import { ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS } from "../helpers/fixture_timing.js";

import { test as base } from "./browser_test.js";
import { startComparisonStaticHost } from "./comparison_static_setup.js";

/** A separate immutable copy leaves the viewer's default membership intact. */
export const test = base.extend<
  object,
  { branchCopy: Awaited<ReturnType<typeof startComparisonStaticHost>> }
>({
  branchCopy: [
    async ({ browserName }, use) => {
      void browserName;
      const copy = await startComparisonStaticHost(
        AbortSignal.timeout(ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS),
        addComparisonFixtureSources,
        "browser-branch-point",
      );
      ownBrowserCleanup(copy.close);
      try {
        await use(copy);
      } finally {
        await copy.close();
      }
    },
    { scope: "worker", timeout: ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS },
  ],
  baseURL: async ({ branchCopy }, use) => {
    await use(branchCopy.url);
  },
});
