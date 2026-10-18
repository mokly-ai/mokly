import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runCaptured } from "../../scripts/verification/process.mjs";

import { test } from "./browser_test.js";

test("automatic browser errors fail real tests for both console and page errors", async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-error-proof-"));
  try {
    const result = await runCaptured(
      process.execPath,
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        "--config=tests/fixtures/browser-errors/playwright.config.ts",
      ],
      {
        cwd: path.resolve(import.meta.dirname, "../.."),
        env: { ...process.env, MOKLY_ERROR_PROBE_OUTPUT: output },
      },
    );
    assert.equal(result.exitCode, 0, result.stderr);
    assert.equal(result.signal, null);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.errors, []);
    assert.equal(report.stats.expected, 2);
    assert.equal(report.stats.unexpected, 0);
    assert.equal(report.stats.skipped, 0);
    const tests = report.suites.flatMap(
      (suite: { specs: { tests: unknown[] }[] }) =>
        suite.specs.flatMap((spec) => spec.tests),
    );
    assert.equal(tests.length, 2);
    for (const [index, result] of tests.entries()) {
      assert.equal(result.expectedStatus, "failed");
      assert.equal(result.results.length, 1);
      assert.equal(result.results[0].status, "failed");
      assert.equal(result.results[0].errors.length, 1);
      const message = result.results[0].errors[0].message;
      assert.match(message, /Unexpected browser errors/u);
      assert.match(
        message,
        index === 0
          ? /unexpected console sentinel/u
          : /unexpected page sentinel/u,
      );
      assert.doesNotMatch(message, /Timeout|timed out/u);
    }
  } finally {
    await fs.rm(output, { recursive: true, force: true });
  }
});
