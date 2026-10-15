import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const shim = fileURLToPath(
  new URL("../packages/mokly/bin/mokly.mjs", import.meta.url),
);

test("the installed shim resolves the viewer from another working directory", async (context) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-shim-viewer-"),
  );
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [shim, "--version"], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, MOKLY_OUTPUT: "plain" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^\d+\.\d+\.\d+\n$/);
  assert.equal(result.stderr, "");
});
