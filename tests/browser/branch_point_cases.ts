/** The shared branch-point cases, registered on one host at both widths. */

import { BRANCH_POINT_CHECKS } from "./branch_point_checks.js";
import {
  BRANCH_POINT_WIDTHS,
  type BranchPointHost,
} from "./branch_point_ui.js";
import type { test as baseTest } from "./browser_test.js";

/**
 * Register every case of `tests/fixtures/branch_point_cases.json` on `host`,
 * which `test` serves, at desktop and mobile widths.
 */
export function registerBranchPointCases(
  test: typeof baseTest,
  host: BranchPointHost,
): void {
  for (const { title, check } of BRANCH_POINT_CHECKS)
    for (const { name: width, ...size } of BRANCH_POINT_WIDTHS)
      test(`${title} renders its branch-point references at ${width} width`, async ({
        page,
      }) => {
        await page.setViewportSize(size);
        await check(page, host);
      });
}
