import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import type { ComparisonAdditions } from "../helpers/comparison_catalogue.js";
import { ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS } from "../helpers/fixture_timing.js";

import { test as browserTest } from "./browser_test.js";
import { startComparisonStaticHost } from "./comparison_static_setup.js";

type Copy = Awaited<ReturnType<typeof startComparisonStaticHost>>;

/**
 * A `test` whose `baseURL` serves its own immutable comparison copy: the
 * default catalogue with `additions`, compared with `base`. Each worker builds
 * the copy once, so the shared copies keep their membership.
 */
export function additionsCopyTest(
  fixtureName: string,
  additions?: ComparisonAdditions,
  base?: string,
) {
  return browserTest.extend<object, { additionsCopy: Copy }>({
    additionsCopy: [
      async ({ browserName }, use) => {
        void browserName;
        const copy = await startComparisonStaticHost(
          AbortSignal.timeout(ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS),
          additions,
          fixtureName,
          base,
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
    baseURL: async ({ additionsCopy }, use) => {
      await use(additionsCopy.url);
    },
  });
}
