/** A child with inherited execArgv must keep ordinary command behavior. */
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import test from "node:test";

test("fork retains output and exit code", async () => {
  const child = fork(new URL("./fork-child.mjs", import.meta.url), [], {
    silent: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  assert.equal(stdout, "guard child stdout\n");
  assert.equal(stderr, "");
  assert.equal(exitCode, 7);
});
