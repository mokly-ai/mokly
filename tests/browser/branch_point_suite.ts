/** Declare the shared branch-point cases for one host at both widths. */

import { expect, test, type Browser } from "@playwright/test";

import { branchPointFixture } from "../helpers/branch_point_fixture.js";
import type { BranchPointCase } from "../helpers/branch_point_sources.js";

import {
  startBranchHost,
  type BranchHost,
  type BranchHostKind,
} from "./branch_hosts.js";
import {
  BRANCH_POINT_CHECKS,
  BRANCH_POINT_COMPARED,
} from "./branch_point_checks.js";
import { BRANCH_POINT_WIDTHS, serverErrors } from "./branch_point_ui.js";

const CASES: readonly BranchPointCase[] = [
  "moved-consumers",
  "moved-parent",
  "moved-variant",
  "case-renames",
  "reused-parent",
  "departed-variants",
];

/**
 * Serve renders comparison documents on demand, and each accepted document
 * republishes evidence. A new evidence revision resets the comparison mode
 * of every workspace, siblings included, so a first comparison would reset
 * the mode the cases check. Rendering those comparisons before the checks
 * keeps the evidence still while they run.
 */
async function prepareServedComparisons(
  browser: Browser,
  host: BranchHost,
  entries: readonly string[],
): Promise<void> {
  const page = await browser.newPage();
  try {
    for (const entry of entries) {
      const review = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/__mokly/diffs/review.json",
      );
      await page.goto(`${host.url}/view/${entry}/?comparison=side`);
      expect((await review).status()).toBeLessThan(400);
    }
  } finally {
    await page.close();
  }
}

/**
 * Start each case once on `kind`, then check its rendered UI at desktop and
 * mobile widths. Starting the export host proves the case exports.
 */
export function branchPointSuite(kind: BranchHostKind): void {
  for (const name of CASES)
    test.describe(`${kind} ${name}`, () => {
      let host: BranchHost | undefined;

      test.beforeAll(async ({ browser }) => {
        test.setTimeout(180_000);
        host = await startBranchHost(kind, () => branchPointFixture(name));
        if (kind === "serve")
          await prepareServedComparisons(
            browser,
            host,
            BRANCH_POINT_COMPARED[name],
          );
      });

      test.afterAll(async () => {
        await host?.close();
      });

      for (const { name: width, ...size } of BRANCH_POINT_WIDTHS)
        test(`${name} renders its branch-point references at ${width} width`, async ({
          page,
        }) => {
          test.setTimeout(120_000);
          await page.setViewportSize(size);
          const failures = serverErrors(page);
          await BRANCH_POINT_CHECKS[name](page, host!, kind);
          expect(failures).toEqual([]);
        });
    });
}
