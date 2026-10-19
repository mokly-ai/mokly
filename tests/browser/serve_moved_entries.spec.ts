import { registerMovedComparisonCases } from "./moved_comparison_cases.js";
import { registerMovedComponentCases } from "./moved_component_cases.js";
import { registerMovedRowCases } from "./moved_row_cases.js";
import { test } from "./serve_comparison_test.js";

registerMovedRowCases(test);
registerMovedComponentCases(test);
registerMovedComparisonCases(test, "serve", true);
