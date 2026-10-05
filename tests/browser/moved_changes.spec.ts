import { test } from "@playwright/test";

import {
  startMovedHost,
  type MovedChangesHost,
} from "./moved_changes_fixture.js";
import { movedComparisonCases } from "./moved_comparison_cases.js";
import { movedComponentCases } from "./moved_component_cases.js";
import { movedRowCases } from "./moved_row_cases.js";

let host: MovedChangesHost;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  host = await startMovedHost("serve");
});

test.afterAll(async () => {
  if (host) await host.close();
});

movedRowCases("serve", () => host);
movedComponentCases("serve", () => host);
movedComparisonCases("serve", () => host);
