/** Declare the shared branch-point cases for one host at both widths. */

import { expect, test } from "@playwright/test";

import { branchPointFixture } from "../helpers/branch_point_fixture.js";
import type { BranchPointCase } from "../helpers/branch_point_sources.js";

import {
  startBranchHost,
  type BranchHost,
  type BranchHostKind,
} from "./branch_hosts.js";
import { BRANCH_POINT_CHECKS } from "./branch_point_checks.js";
import { BRANCH_POINT_WIDTHS, serverErrors } from "./branch_point_ui.js";

const CASES: readonly BranchPointCase[] = [
  "moved-consumers",
  "moved-parent",
  "moved-variant",
  "case-renames",
  "reused-parent",
];

/**
 * Start each case once on `kind`, then check its rendered UI at desktop and
 * mobile widths. Starting the export host proves the case exports.
 */
export function branchPointSuite(kind: BranchHostKind): void {
  for (const name of CASES)
    test.describe(`${kind} ${name}`, () => {
      let host: BranchHost | undefined;

      test.beforeAll(async () => {
        test.setTimeout(180_000);
        host = await startBranchHost(kind, () => branchPointFixture(name));
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
