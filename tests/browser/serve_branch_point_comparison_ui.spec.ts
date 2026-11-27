/**
 * The branch-point cases that Serve alone exercises, under the branch-point
 * lookup contract. Side by side on a moved variant starts an on-demand
 * capture, and its comparison details show the saved props. An Affected link
 * that asks for Side by side starts an on-demand capture, and the link to an
 * Added consumer requests no comparison. One Serve per worker serves the
 * shared comparison fixture, whose sources include the branch-point cases.
 * The checks only read it, and each Side by side waits for its comparison
 * response. The branch copy runs every case.
 */

import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import { ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS } from "../helpers/fixture_timing.js";

import { registerBranchPointCases } from "./branch_point_cases.js";
import { test as base } from "./browser_test.js";
import { serveMovedHost } from "./moved_rows.js";
import { serveComparisonCatalogue } from "./serve_comparison_fixture.js";

type Served = Awaited<ReturnType<typeof serveComparisonCatalogue>>;

const test = base.extend<object, { servedBranch: Served }>({
  servedBranch: [
    async ({ browserName }, use) => {
      void browserName;
      const served = await serveComparisonCatalogue();
      ownBrowserCleanup(served.close);
      try {
        await use(served);
      } finally {
        await served.close();
      }
    },
    { scope: "worker", timeout: ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS },
  ],
  baseURL: async ({ servedBranch }, use) => {
    await use(servedBranch.url);
  },
});

registerBranchPointCases(test, serveMovedHost, [
  { name: "moved-variant", width: "desktop" },
  { name: "affected-destinations", width: "desktop" },
]);
