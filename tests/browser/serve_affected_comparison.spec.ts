import { registerAffectedComparisons } from "./affected_comparison_cases.js";
import { test } from "./serve_comparison_test.js";

registerAffectedComparisons(test, "serve");
