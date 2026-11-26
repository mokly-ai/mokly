/**
 * The moved-entry case that Serve alone exercises: Serve captures the moved
 * screen's comparison on demand, with the version at its previous path. The
 * branch copy runs every moved-entry case in `static_moved_entries.spec.ts`.
 */

import { registerMovedScreenComparison } from "./moved_comparison_cases.js";
import { serveMovedHost } from "./moved_rows.js";
import { test } from "./serve_comparison_test.js";

registerMovedScreenComparison(test, serveMovedHost);
