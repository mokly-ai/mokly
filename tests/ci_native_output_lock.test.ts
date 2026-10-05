import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

interface NativeWorkflow {
  jobs: {
    native: {
      strategy: { matrix: { os: readonly string[] } };
      steps: readonly { run?: string }[];
    };
  };
}

test("native macOS and Windows jobs verify the generated-output writer lock", async () => {
  const workflow = parse(
    await fs.readFile(
      path.join(repositoryRoot, ".github/workflows/ci.yml"),
      "utf8",
    ),
  ) as NativeWorkflow;
  const native = workflow.jobs.native;
  assert.ok(native.strategy.matrix.os.some((os) => os.includes("macos")));
  assert.ok(native.strategy.matrix.os.some((os) => os.includes("windows")));
  for (const file of [
    "tests/generated_output_lock.test.ts",
    "tests/path_transaction_regressions.test.ts",
  ])
    assert.ok(
      native.steps.some((step) => step.run?.includes(file)),
      `native transaction coverage includes ${file}`,
    );
});
