import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import {
  createHarness,
  runWrapper,
  writeHarnessFile,
} from "./verification_wrapper.js";

export interface SelectedHarness {
  root: string;
  temporary: string;
}

export async function createSelectedHarness(
  context: TestContext,
): Promise<SelectedHarness> {
  const root = await createHarness();
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const temporary = path.join(root, "temporary");
  await fs.mkdir(temporary);
  await writeHarnessFile(
    root,
    "tests/passing.test.ts",
    'import test from "node:test";\ntest("selected passing sentinel", () => {});\n',
  );
  await writeHarnessFile(
    root,
    "tests/failing.test.ts",
    'import fs from "node:fs";\nimport test from "node:test";\ntest("selected failing sentinel", () => {\n  fs.writeFileSync("test-ran.marker", "ran");\n  throw new Error("selected failure sentinel");\n});\n',
  );
  return { root, temporary };
}

export async function runSelected(
  harness: SelectedHarness,
  args: readonly string[],
  report?: string,
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await runWrapper(harness.root, "run-unit-dev.mjs", {
      args,
      cwd: path.join(harness.root, "packages/viewer"),
      environment: {
        TMPDIR: harness.temporary,
        TMP: harness.temporary,
        TEMP: harness.temporary,
        TSX_DISABLE_CACHE: "1",
      },
      ...(report ? { report } : {}),
    });
  } finally {
    assert.deepEqual(await fs.readdir(harness.temporary), []);
  }
}
