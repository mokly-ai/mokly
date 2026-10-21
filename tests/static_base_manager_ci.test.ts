import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execute = promisify(execFile);

test(
  "base manager and cold-tier tests pass with hosted CI defaults",
  { timeout: 360_000 },
  async (context) => {
    const { stdout } = await execute(
      process.execPath,
      [
        "scripts/verification/run-viewer.mjs",
        "tests/static_base_managers.test.ts",
        "tests/static_base_registry.test.ts",
        "tests/static_base_manager_mirror.test.ts",
        "tests/static_cold_base_tiers.test.ts",
      ],
      {
        cwd: path.resolve(import.meta.dirname, ".."),
        env: {
          ...process.env,
          NODE_TEST_CONTEXT: undefined,
          CI: "true",
          GITHUB_ACTIONS: "true",
        },
        signal: context.signal,
        maxBuffer: 4 * 1024 * 1024,
      },
    ).catch((error: unknown) => {
      if (
        error instanceof Error &&
        "stdout" in error &&
        typeof error.stdout === "string"
      )
        context.diagnostic(error.stdout);
      throw error;
    });
    assert.match(stdout, /unit tests skipped or todo: 0/u);
    assert.match(stdout, /selected files: 4; tests run: [1-9]\d*;/u);
  },
);
