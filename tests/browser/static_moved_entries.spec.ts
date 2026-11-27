/**
 * Every moved-entry case on the branch copy. Serve and the embedded viewer
 * run only the case that their own delivery needs.
 */

import { test } from "./branch_point_test.js";
import { registerMovedComparisonCases } from "./moved_comparison_cases.js";
import { registerMovedComponentCases } from "./moved_component_cases.js";
import { registerMovedRowCases } from "./moved_row_cases.js";
import { copyMovedHost } from "./moved_rows.js";

registerMovedRowCases(test, copyMovedHost);
registerMovedComponentCases(test, copyMovedHost);
registerMovedComparisonCases(test, copyMovedHost);
