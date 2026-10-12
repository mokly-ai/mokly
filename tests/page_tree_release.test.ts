import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

test("classification releases page trees while keeping CSS proof", async () => {
  const { stdout } = await promisify(execFile)(process.execPath, [
    "--expose-gc",
    "--import",
    "tsx",
    fileURLToPath(new URL("./helpers/page_tree_release.mjs", import.meta.url)),
  ]);
  const result = JSON.parse(stdout) as { trees: number; retained: number };
  assert.ok(result.trees > 0);
  assert.equal(result.retained, 0);
});
