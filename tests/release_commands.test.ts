import assert from "node:assert/strict";
import test from "node:test";

import { executable } from "../scripts/release/executable.mjs";

test("Windows npm uses its JavaScript entrypoint with literal archive arguments", () => {
  const args = ["pack", "C:\\archives with spaces\\a&b.tgz"];
  assert.deepEqual(
    executable("npm", args, "win32", "C:\\Node\\node.exe", "C:\\npm\\npm.cmd"),
    {
      file: "C:\\Node\\node.exe",
      args: ["C:\\npm\\node_modules\\npm\\bin\\npm-cli.js", ...args],
    },
  );
  assert.deepEqual(
    executable("npm", args, "win32", "node", "C:\\npm\\bin\\npm-cli.js"),
    { file: "node", args: ["C:\\npm\\bin\\npm-cli.js", ...args] },
  );
  assert.deepEqual(executable("npm", args, "linux", "node"), {
    file: "npm",
    args,
  });
  assert.deepEqual(executable("cargo", args, "win32", "node"), {
    file: "cargo",
    args,
  });
});
