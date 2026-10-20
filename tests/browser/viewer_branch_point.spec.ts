/**
 * The branch-point cases in an embedded `MoklyViewer` over the branch copy,
 * through both frame adapters, at desktop and mobile widths, under the
 * branch-point lookup contract. The host page gives the viewer the window
 * width, so the mobile run shows a narrow viewer with its compact search. It
 * opens an entry by query, so the checks read the selected entry from the
 * workspace head.
 */

import { registerBranchPointCases } from "./branch_point_cases.js";
import { test } from "./branch_viewer_test.js";
import { embeddedMovedHost } from "./moved_rows.js";

for (const adapter of ["same-origin", "cross"] as const)
  test.describe(`${adapter} adapter`, () => {
    registerBranchPointCases(test, embeddedMovedHost(adapter));
  });
