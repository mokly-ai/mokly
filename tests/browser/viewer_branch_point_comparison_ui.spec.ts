/**
 * The branch-point cases' rendered references in an embedded `MoklyViewer`
 * over the branch copy, through both frame adapters, at desktop and mobile
 * widths, under the branch-point lookup contract. The host page opens an
 * entry by query and keeps its own address, so each navigation checks the
 * rendered head and that the page path stays `/viewer.html`.
 */

import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";

import { BRANCH_POINT_CHECKS } from "./branch_point_checks.js";
import { test as branchTest } from "./branch_point_test.js";
import { BRANCH_POINT_WIDTHS } from "./branch_point_ui.js";
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
  const host = embeddedHost(adapter);
  test.describe(`${adapter} adapter`, () => {
    for (const [name, check] of Object.entries(BRANCH_POINT_CHECKS))
      for (const { name: width, ...size } of BRANCH_POINT_WIDTHS)
        test(`${name} renders its branch-point references at ${width} width`, async ({
          page,
        }) => {
          await page.setViewportSize(size);
          await check(page, host);
        });
  });
}
