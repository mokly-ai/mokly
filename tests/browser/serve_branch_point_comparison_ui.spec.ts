/**
 * The branch-point cases' rendered references through Serve at desktop and
 * mobile widths, under the branch-point lookup contract. One Serve per
 * worker serves the shared comparison fixture, whose sources include the
 * branch-point cases. The checks only read it, and Serve renders each
 * selected comparison on demand.
 */

import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import { ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS } from "../helpers/fixture_timing.js";

import { BRANCH_POINT_CHECKS } from "./branch_point_checks.js";
import { BRANCH_POINT_WIDTHS, ROUTED_HOST } from "./branch_point_ui.js";
import { test as base } from "./browser_test.js";
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

for (const [name, check] of Object.entries(BRANCH_POINT_CHECKS))
  for (const { name: width, ...size } of BRANCH_POINT_WIDTHS)
    test(`${name} renders its branch-point references at ${width} width`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await check(page, ROUTED_HOST);
    });
