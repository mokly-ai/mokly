/**
 * The moved-entry cases in an embedded `MoklyViewer` over the branch copy,
 * through both frame adapters. The host page opens an entry by query and
 * keeps its own address, so a case that navigates checks that the page path
 * stays `/viewer.html`.
 */

import { test } from "./branch_viewer_test.js";
import { registerMovedComparisonCases } from "./moved_comparison_cases.js";
import { registerMovedComponentCases } from "./moved_component_cases.js";
import { registerMovedRowCases } from "./moved_row_cases.js";
import { embeddedMovedHost } from "./moved_rows.js";

for (const adapter of ["same-origin", "cross"] as const)
  test.describe(`${adapter} adapter`, () => {
    const host = embeddedMovedHost(adapter);
    registerMovedRowCases(test, host);
    registerMovedComponentCases(test, host);
    registerMovedComparisonCases(test, host);
  });
