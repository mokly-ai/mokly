/**
 * The branch-point cases' rendered references in an embedded `MoklyViewer`
 * over the branch copy, through both frame adapters, at desktop and mobile
 * widths, under the branch-point lookup contract. The host page opens an
 * entry by query and keeps its own address, so each navigation checks the
 * rendered head and that the page path stays `/viewer.html`.
 */

import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";

import { registerBranchPointCases } from "./branch_point_cases.js";
import { test as branchTest } from "./branch_point_test.js";
import {
  comparisonViewerHost,
  type ComparisonViewerHost,
} from "./comparison_viewer_host.js";
import { embeddedHost } from "./entry_hosts.js";

const test = branchTest.extend<object, { branchViewer: ComparisonViewerHost }>({
  branchViewer: [
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
  baseURL: async ({ branchViewer }, use) => {
    await use(branchViewer.url);
  },
});

for (const adapter of ["same-origin", "cross"] as const) {
  const host = { ...embeddedHost(adapter), comparisons: "published" as const };
  test.describe(`${adapter} adapter`, () => {
    registerBranchPointCases(test, host);
  });
}
