import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import {
  createCoverageHarness,
  runCoverage,
  writeCoverageThresholds,
  writeHarnessFile,
} from "./helpers/coverage_harness.js";

test("generated output that a bounded child runs maps back to its source", async () => {
  const root = await createCoverageHarness();
  try {
    await writeCoverageThresholds(root, {
      lines: 0,
      branches: 0,
      functions: 0,
    });
    await writeHarnessFile(
      root,
      "src/generated.ts",
      `export function reached(): string {
  return "reached by a child process";
}

export function unreached(): string {
  return "never executed by the child process";
}

console.log(reached());
`,
    );
    await build({
      entryPoints: [path.join(root, "src/generated.ts")],
      format: "esm",
      logLevel: "silent",
      outfile: path.join(root, "dist/generated.js"),
      platform: "node",
      sourcemap: true,
    });
    await writeHarnessFile(root, "dist/package.json", '{"type":"module"}\n');
    await writeHarnessFile(root, "dist/plain.js", 'console.log("plain");\n');
    await writeHarnessFile(
      root,
      "tests/child.test.ts",
      `import { execFileSync } from "node:child_process";
import test from "node:test";

test("a child with a bounded environment runs generated output", () => {
  const env = { PATH: process.env.PATH };
  execFileSync(process.execPath, ["dist/generated.js"], { env });
  execFileSync(process.execPath, ["dist/plain.js"], { env });
});
`,
    );
    const run = await runCoverage(root, []);
    assert.equal(run.summary.outcome.status, "passed", run.stderr);
    assert.deepEqual(
      run.summary.files.map((record) => record.file),
      ["src/generated.ts", "src/subject.ts"],
    );
    const generated = run.summary.files.find(
      (record) => record.file === "src/generated.ts",
    );
    assert.deepEqual(generated?.functions, {
      covered: 1,
      total: 2,
      percent: 50,
    });
    assert.deepEqual(
      run.summary.unmapped.map((record) => record.file),
      ["dist/plain.js"],
    );
    assert.match(
      run.stdout,
      /generated files without source mapping, excluded from totals \(1\):\n {2}dist\/plain\.js\n/u,
    );
    const lcov = await fs.readFile(
      path.join(root, "coverage/lcov.info"),
      "utf8",
    );
    assert.match(lcov, /^SF:src[\\/]generated\.ts$/mu);
    assert.match(lcov, /^SF:dist[\\/]plain\.js$/mu);
    assert.doesNotMatch(lcov, /^SF:dist[\\/]generated\.js$/mu);
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
});
