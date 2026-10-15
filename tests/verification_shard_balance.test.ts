import assert from "node:assert/strict";
import test from "node:test";

import {
  BROWSER_SHARD_SHARE_LIMIT,
  validateBrowserShardBalance,
} from "../scripts/verification/shard-balance.mjs";

/** Keep the pure balance policy available for the browser suite's return. */
test("browser balance uses test counts and the reviewed share limit", () => {
  assert.equal(BROWSER_SHARD_SHARE_LIMIT, 1.25);
  const reports = [3, 3, 2, 2].map((count, index) => ({
    shard: { index: index + 1, total: 4 },
    assignedTests: Array.from({ length: count }, (_, offset) => ({
      id: `${index}-${offset}`,
    })),
  }));
  validateBrowserShardBalance(reports, 10, 4);
  reports[0]!.assignedTests = Array.from({ length: 5 }, (_, index) => ({
    id: `extra-${index}`,
  }));
  assert.throws(
    () => validateBrowserShardBalance(reports, 10, 4),
    /browser shard 1\/4 holds 5 of 10 tests, above the limit of 4/,
  );
});
