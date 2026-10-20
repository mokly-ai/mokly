import assert from "node:assert/strict";
import { test } from "node:test";

import type { UsageLink } from "../src/shell/workspace_data.js";
import { usageRows } from "../src/shell/workspace_usage.js";

/** One Used by link of the consumer screen, with chosen fields replaced. */
function link(overrides: Partial<UsageLink> = {}): UsageLink {
  return {
    entryId: "screens/consumer",
    entryKind: "screen",
    title: "Consumer screen",
    viewport: "mobile",
    colorScheme: "light",
    instanceKey: "a".repeat(64),
    direct: true,
    removed: false,
    comparisonEligible: false,
    ...overrides,
  };
}

test("a row keeps its key when an update changes only comparison eligibility", () => {
  const unchanged = usageRows([link(), link({ viewport: "desktop" })]);
  const classified = usageRows([
    link({ comparisonEligible: true }),
    link({ viewport: "desktop", comparisonEligible: true }),
  ]);
  assert.equal(unchanged.length, 1);
  assert.equal(unchanged[0]!.links.length, 2);
  assert.deepEqual(
    classified.map((row) => row.key),
    unchanged.map((row) => row.key),
  );
});

test("the current and removed rows of one entry have different keys", () => {
  const rows = usageRows([link(), link({ removed: true })]);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0]!.key, rows[1]!.key);
});

test("a removed row keeps its key alone and beside the current row of its entry", () => {
  const removed = link({ removed: true });
  const [alone] = usageRows([removed]);
  const beside = usageRows([link(), removed]);
  assert.deepEqual(
    beside.map((row) => row.links[0]!.removed),
    [false, true],
  );
  assert.equal(beside[1]!.key, alone!.key);
});

test("a row keeps its key with and without another entry's row before it", () => {
  const [alone] = usageRows([link()]);
  const after = usageRows([
    link({ entryId: "screens/changed", title: "Changed screen" }),
    link(),
  ]);
  assert.deepEqual(
    after.map((row) => row.links[0]!.entryId),
    ["screens/changed", "screens/consumer"],
  );
  assert.equal(after[1]!.key, alone!.key);
});

test("rows that differ only in eligibility stay apart with distinct keys", () => {
  const rows = usageRows([
    link(),
    link({ comparisonEligible: true, instanceKey: "b".repeat(64) }),
    link({ viewport: "desktop" }),
  ]);
  assert.deepEqual(
    rows.map((row) => row.links.map((value) => value.comparisonEligible)),
    [[false, false], [true]],
  );
  assert.equal(new Set(rows.map((row) => row.key)).size, 2);
});
