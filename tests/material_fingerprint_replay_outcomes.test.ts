import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";

const execute = promisify(execFile);
test("catalogue replay rejects equal replay errors after an original success", async () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  let failed = false;
  try {
    await execute(
      process.execPath,
      [
        "--experimental-test-module-mocks",
        "--import",
        "tsx",
        "--import",
        "./tests/helpers/fingerprint_catalogue_failure_probe.mjs",
        "--test",
        "tests/changes_inline_styles_fast_path.test.ts",
      ],
      { env, maxBuffer: 8 * 1024 ** 2 },
    );
  } catch (error) {
    const output = error as { stdout?: string; stderr?: string };
    assert.match(
      (output.stdout ?? "") + (output.stderr ?? ""),
      /original catalogue/,
    );
    failed = true;
  }
  assert.ok(
    failed,
    "equal replay errors must not pass when the original returned a result",
  );
});
