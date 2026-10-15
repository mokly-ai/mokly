import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

test("packing rejects unknown and extra arguments before reading any artifact", async () => {
  const script = path.join(repositoryRoot, "scripts/release/pack.mjs");
  for (const args of [
    ["missing-artifacts", "--unknown"],
    ["missing-artifacts", "--reuse", "extra"],
    ["missing-artifacts", "--unknown", "extra"],
  ]) {
    await assert.rejects(
      execute(process.execPath, [script, ...args], { cwd: repositoryRoot }),
      (error) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /usage: pack\.mjs/);
        assert.doesNotMatch(error.message, /ENOENT/);
        return true;
      },
    );
  }
});
