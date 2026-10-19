import { ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS } from "../helpers/fixture_timing.js";

import { test as base } from "./browser_test.js";
import { serveComparisonCatalogue } from "./serve_comparison_fixture.js";

/** Each test gets its own writable base ref, watcher, and comparison generations. */
export const test = base.extend<{
  changes: Awaited<ReturnType<typeof serveComparisonCatalogue>>;
}>({
  changes: [
    async ({ browserName }, use) => {
      void browserName;
      const fixture = await serveComparisonCatalogue();
      try {
        await use(fixture);
      } finally {
        await fixture.close();
      }
    },
    { timeout: ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS },
  ],
  baseURL: async ({ changes }, use) => {
    await use(changes.url);
  },
});
