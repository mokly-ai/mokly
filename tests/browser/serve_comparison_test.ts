import type { ComparisonAdditions } from "../helpers/comparison_catalogue.js";
import { ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS } from "../helpers/fixture_timing.js";

import { test as base } from "./browser_test.js";
import { serveComparisonCatalogue } from "./serve_comparison_fixture.js";

/** A spec's own source hook, wrapped because `test.use` reads a function as a fixture. */
export interface ComparisonSources {
  add: ComparisonAdditions;
}

/**
 * Each test gets its own writable base ref, watcher, and comparison
 * generations. `comparisonSources` adds a spec's own sources to both commits
 * after the shared hooks; it is unset by default.
 */
export const test = base.extend<{
  changes: Awaited<ReturnType<typeof serveComparisonCatalogue>>;
  comparisonSources: ComparisonSources | undefined;
}>({
  comparisonSources: [undefined, { option: true }],
  changes: [
    async ({ browserName, comparisonSources }, use) => {
      void browserName;
      const fixture = await serveComparisonCatalogue(comparisonSources?.add);
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
