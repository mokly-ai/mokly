/**
 * The branch-point cases that an embedded `MoklyViewer` over the branch copy
 * alone exercises, through both frame adapters, under the branch-point lookup
 * contract. The host page gives the viewer the window width, so each mobile
 * run expects a narrow viewer with its compact search control. It opens an
 * entry by query and keeps its own address, so each navigation checks that
 * the page path stays `/viewer.html`. Affected destinations runs on both
 * adapters, because a React host opens an Affected link in Current. Moved
 * parent runs on the cross-origin adapter, for the compact search that
 * filters Changes and keeps its query. The branch copy runs every case.
 */

import { registerBranchPointCases } from "./branch_point_cases.js";
import { test } from "./branch_viewer_test.js";
import { embeddedMovedHost } from "./moved_rows.js";

test.describe("same-origin adapter", () => {
  registerBranchPointCases(test, embeddedMovedHost("same-origin"), [
    { name: "affected-destinations", width: "mobile" },
  ]);
});

test.describe("cross adapter", () => {
  registerBranchPointCases(test, embeddedMovedHost("cross"), [
    { name: "affected-destinations", width: "mobile" },
    { name: "moved-parent", width: "mobile" },
  ]);
});
