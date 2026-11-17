import assert from "node:assert/strict";
import { spawn } from "node:child_process";

import { parseShardArgument } from "../../scripts/verification/browser-shard.mjs";
import { childEnvironment } from "../../scripts/verification/child-environment.mjs";
import {
  readSourceTree,
  validateFingerprint,
} from "../../scripts/verification/source-tree.mjs";

const args = process.argv.slice(2);
assert(
  args.length === 4 || args.length === 6,
  "Expected --expect FINGERPRINT --suites LIST [--shard INDEX/TOTAL]",
);
assert.equal(args[0], "--expect");
assert.equal(args[2], "--suites");
const fingerprint = validateFingerprint(args[1]);
assert.equal(
  await readSourceTree(process.cwd()),
  fingerprint,
  "Cloud worker source tree differs",
);
const suites = args[3].split(",");
assert(
  suites.length > 0 && suites.every((suite) => /^cloud-[a-z-]+$/.test(suite)),
  "Invalid cloud suite list",
);
assert.equal(new Set(suites).size, suites.length, "Duplicate cloud suite");
const shard = parseShardArgument(args.slice(4));
if (shard) {
  assert.deepEqual(suites, ["cloud-app"], "Only cloud-app accepts a shard");
}
const env = childEnvironment(process.env);
for (const name of [
  "BLACKSMITH_ORG_TOKEN",
  "GITHUB_SHA",
  "GITHUB_ACTIONS",
  "CI",
])
  delete env[name];

async function run(program, commandArgs) {
  return await new Promise((resolve, reject) => {
    const child = spawn(program, commandArgs, { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
}

assert.equal(
  await run("git", ["fetch", "--tags", "origin", "main"]),
  0,
  "Cloud base fetch failed",
);
assert.equal(await run("npm", ["ci"]), 0, "Cloud npm install failed");
assert.equal(
  await run("npx", ["playwright", "install", "chromium"]),
  0,
  "Cloud Chromium install failed",
);
const failed = [];
for (const suite of suites) {
  console.log(`RUN ${suite}`);
  const command = ["xtask", "check", "--executor", "local", "--suite", suite];
  if (shard) command.push("--shard", `${shard.index}/${shard.total}`);
  const code = await run("cargo", command);
  console.log(`${code === 0 ? "PASS" : "FAIL"} ${suite} (exit ${code})`);
  if (code !== 0) failed.push(suite);
}
if (failed.length) console.error(`Cloud suites failed: ${failed.join(", ")}`);
process.exitCode = failed.length ? 1 : 0;
