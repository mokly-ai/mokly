/**
 * The branch-point cases' rendered references through Serve at desktop and
 * mobile widths, under the branch-point lookup contract. One Serve per
 * worker serves the shared comparison fixture, whose sources include the
 * branch-point cases. The checks only read it. Each Side by side waits for
 * its comparison response. The first Side by side of an entry starts an
 * on-demand capture, and a later run of that entry reads the stored
 * comparison while Serve keeps it.
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

registerBranchPointCases(test, serveMovedHost);
