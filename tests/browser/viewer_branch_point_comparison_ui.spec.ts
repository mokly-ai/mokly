/**
 * The branch-point cases' rendered references in an embedded `MoklyViewer`
 * over the branch copy, through both frame adapters, at desktop and mobile
 * widths, under the branch-point lookup contract. The host page gives the
 * viewer the window width, so each mobile run expects a narrow viewer with
 * its compact search control. It opens an entry by query and keeps its own
 * address, so each navigation checks the rendered head and that the page
 * path stays `/viewer.html`.
 */

import { registerBranchPointCases } from "./branch_point_cases.js";
import { test } from "./branch_viewer_test.js";
import { embeddedMovedHost } from "./moved_rows.js";

for (const adapter of ["same-origin", "cross"] as const)
  test.describe(`${adapter} adapter`, () => {
    registerBranchPointCases(test, embeddedMovedHost(adapter));
  });
