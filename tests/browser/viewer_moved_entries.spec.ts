/**
 * The moved-entry case that shows how an embedded `MoklyViewer` over the
 * branch copy opens an entry, through both frame adapters. The host page
 * opens an entry by query and keeps its own address, so a catalogue row
 * keeps the page path `/viewer.html`. The branch copy runs every moved-entry
 * case in `static_moved_entries.spec.ts`.
 */

import { test } from "./branch_viewer_test.js";
import { registerMovedParentNavigation } from "./moved_component_cases.js";
import { embeddedMovedHost } from "./moved_rows.js";

for (const adapter of ["same-origin", "cross"] as const)
  test.describe(`${adapter} adapter`, () => {
    registerMovedParentNavigation(test, embeddedMovedHost(adapter));
  });
