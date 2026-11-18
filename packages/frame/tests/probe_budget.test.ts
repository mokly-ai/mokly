import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("the built probe keeps the 9 KiB publication budget", async () => {
  const probe = await fs.readFile(
    path.resolve(import.meta.dirname, "../dist/browser/frame-probe.js"),
  );
  assert.ok(
    probe.length <= 9216,
    `Probe exceeds 9,216-byte budget: ${probe.length} bytes`,
  );
});
