/**
 * The branch-point cases' rendered references in the copied branch-point
 * output, under the branch-point lookup contract: affected destinations,
 * saved props, removed rows, kept comparison mode, Changes activation, and
 * crumb text and links. Every case runs at desktop width, and affected
 * destinations also at mobile width. Serve and the embedded viewer run only
 * the cases that their own delivery needs.
 */

import { registerBranchPointCases } from "./branch_point_cases.js";
import { test } from "./branch_point_test.js";
import { copyMovedHost } from "./moved_rows.js";

registerBranchPointCases(test, copyMovedHost);
