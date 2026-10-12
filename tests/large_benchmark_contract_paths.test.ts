import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

test("benchmark contracts describe path membership and path-based tokens", async () => {
  const timing = await fs.readFile("docs/protocol/mokly-timings.md", "utf8");
  const contract = await fs.readFile(
    "tests/fixtures/large/benchmark-contract.md",
    "utf8",
  );
  assert.doesNotMatch(timing, /expectedChangedIds|changedIds|delivered id set/);
  assert.match(timing, /`expectedChangedPaths`/);
  assert.match(timing, /`changedPaths`/);
  assert.match(timing, /delivered path set/);
  assert.match(
    contract,
    /JSON\.stringify\(\[entry\.path, viewport, colorScheme\]\)/,
  );
  assert.doesNotMatch(contract, /entry\.id/);
});
