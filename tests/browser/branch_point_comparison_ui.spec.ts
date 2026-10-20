/**
 * The branch-point cases' rendered references in the copied branch-point
 * output at desktop and mobile widths, under the branch-point lookup
 * contract: affected destinations, saved props, removed rows, kept
 * comparison mode, Changes activation, and crumb text and links. Serve and
 * the embedded viewer run the same cases.
 */

import { registerBranchPointCases } from "./branch_point_cases.js";
import { test } from "./branch_point_test.js";
import { copyMovedHost } from "./moved_rows.js";

registerBranchPointCases(test, copyMovedHost);
