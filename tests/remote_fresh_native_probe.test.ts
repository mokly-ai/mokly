import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("the remote suite sees the fresh native binary", async () => {
  const binary = await fs.readFile(
    path.join("packages/native-linux-x64-gnu/bin/mokly"),
  );
  assert.ok(
    binary.includes(Buffer.from("MOKLY_TEST_REMOTE_FRESH_NATIVE\0")),
    "remote suite must run the native binary built from this source",
  );
});
