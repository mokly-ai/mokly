import { registerMovedComparisonCases } from "./moved_comparison_cases.js";
import { registerMovedComponentCases } from "./moved_component_cases.js";
import { registerMovedRowCases } from "./moved_row_cases.js";
import { serveMovedHost } from "./moved_rows.js";
import { test } from "./serve_comparison_test.js";

registerMovedRowCases(test, serveMovedHost);
registerMovedComponentCases(test, serveMovedHost);
registerMovedComparisonCases(test, serveMovedHost);
