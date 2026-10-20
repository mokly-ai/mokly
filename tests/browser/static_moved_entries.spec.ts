import { test } from "./branch_point_test.js";
import { registerMovedComparisonCases } from "./moved_comparison_cases.js";
import { registerMovedComponentCases } from "./moved_component_cases.js";
import { registerMovedRowCases } from "./moved_row_cases.js";
import { copyMovedHost } from "./moved_rows.js";

// The base row on this copy owns the moved variant's copied comparison bytes.
registerMovedRowCases(test, copyMovedHost);
registerMovedComponentCases(test, copyMovedHost);
registerMovedComparisonCases(test, copyMovedHost, false);
