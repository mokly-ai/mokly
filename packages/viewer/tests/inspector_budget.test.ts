import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("the built inspector keeps the 9 KiB publication budget", async () => {
  const inspector = await fs.readFile(
    path.resolve(import.meta.dirname, "../dist/browser/inspector.js"),
  );
  assert.ok(
    inspector.length <= 9216,
    `Inspector exceeds 9,216-byte budget: ${inspector.length} bytes`,
  );
});
