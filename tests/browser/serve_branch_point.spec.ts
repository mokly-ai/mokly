/**
 * The branch-point cases on the private Serve fixture at desktop and mobile
 * widths, under the branch-point lookup contract. Each test has its own
 * Serve over the same shared cases that the branch copy shows, and each
 * comparison waits for its on-demand capture.
 */

import { registerBranchPointCases } from "./branch_point_cases.js";
import { serveMovedHost } from "./moved_rows.js";
import { test } from "./serve_comparison_test.js";

registerBranchPointCases(test, serveMovedHost);
