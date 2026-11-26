/** The shared branch-point cases, registered on one host at chosen widths. */

import {
  BRANCH_POINT_CHECKS,
  branchPointCheck,
  type BranchPointCaseName,
} from "./branch_point_checks.js";
import {
  BRANCH_POINT_WIDTHS,
  type BranchPointHost,
} from "./branch_point_ui.js";
import type { test as baseTest } from "./browser_test.js";

/** A width that a branch-point case renders at. */
export type BranchPointWidth = keyof typeof BRANCH_POINT_WIDTHS;

/** One case of the shared set at one width. */
export interface BranchPointRun {
  /** The case's name in `tests/fixtures/branch_point_cases.json`. */
  name: BranchPointCaseName;
  width: BranchPointWidth;
}

/**
 * The full set, which the branch copy runs: every case at desktop width.
 * Affected destinations also runs at mobile width, because the compact layout
 * compares the one frame that each link opens, so its outcome lines differ.
 */
export const ALL_BRANCH_POINT_RUNS: readonly BranchPointRun[] =
  BRANCH_POINT_CHECKS.flatMap(({ name }) => [
    { name, width: "desktop" as const },
    ...(name === "affected-destinations"
      ? [{ name, width: "mobile" as const }]
      : []),
  ]);

/** Register each run of `runs` on `host`, which `test` serves. */
export function registerBranchPointCases(
  test: typeof baseTest,
  host: BranchPointHost,
  runs: readonly BranchPointRun[] = ALL_BRANCH_POINT_RUNS,
): void {
  for (const { name, width } of runs) {
    const { title, check } = branchPointCheck(name);
    test(`${title} renders its branch-point references at ${width} width`, async ({
      page,
    }) => {
      await page.setViewportSize(BRANCH_POINT_WIDTHS[width]);
      await check(page, host);
    });
  }
}
