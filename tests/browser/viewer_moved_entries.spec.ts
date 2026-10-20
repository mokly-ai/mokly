/**
 * The moved-entry cases in an embedded `MoklyViewer` over the branch copy,
 * through both frame adapters. The host page opens an entry by query, so
 * the case that follows the page address runs only on the routing hosts.
 */

import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";

import { test as branchTest } from "./branch_point_test.js";
import {
  comparisonViewerHost,
  type ComparisonViewerHost,
} from "./comparison_viewer_host.js";
import { registerMovedComparisonCases } from "./moved_comparison_cases.js";
import { registerMovedComponentCases } from "./moved_component_cases.js";
import { registerMovedRowCases } from "./moved_row_cases.js";
import { embeddedMovedHost } from "./moved_rows.js";

const test = branchTest.extend<object, { movedViewer: ComparisonViewerHost }>({
  movedViewer: [
    async ({ branchCopy }, use) => {
      const host = await comparisonViewerHost(branchCopy.directory);
      let closing: Promise<void> | undefined;
      const close = () => (closing ??= host.close());
      ownBrowserCleanup(close);
      try {
        await use(host);
      } finally {
        await close();
      }
    },
    { scope: "worker" },
  ],
  baseURL: async ({ movedViewer }, use) => {
    await use(movedViewer.url);
  },
});

for (const adapter of ["same-origin", "cross"] as const)
  test.describe(`${adapter} adapter`, () => {
    const host = embeddedMovedHost(adapter);
    registerMovedRowCases(test, host);
    registerMovedComponentCases(test, host);
    registerMovedComparisonCases(test, host);
  });
