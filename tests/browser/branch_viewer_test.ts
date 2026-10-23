/**
 * An embedded `MoklyViewer` over the branch copy, through the host page of
 * `comparison_viewer_host.ts`. One host serves every test of a worker.
 */

import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";

import { test as branchTest } from "./branch_point_test.js";
import {
  comparisonViewerHost,
  type ComparisonViewerHost,
} from "./comparison_viewer_host.js";

export const test = branchTest.extend<
  object,
  { branchViewer: ComparisonViewerHost }
>({
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
