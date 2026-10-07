import fs from "node:fs/promises";
import path from "node:path";

import { NodeBaselineProcessRunner } from "../../dist/baseline/process.js";
import type { BaselineProcessRunner } from "../../dist/baseline/types.js";

import { createSourceExampleBaseline } from "./example_baseline.js";
import { FULL_CATALOGUE_SETUP_TIMEOUT_MS } from "./fixture_timing.js";

/** Execute the actual cold build script, never a direct preview assembly shortcut. */
export async function runColdPreviewBuild(
  root: string,
  output: string,
  includeChanges: boolean,
  options: {
    createSource?: (root: string) => Promise<unknown>;
    runner?: BaselineProcessRunner;
  } = {},
): Promise<void> {
  await (
    options.createSource ??
    ((root) => createSourceExampleBaseline(root, "static-example"))
  )(root);
  for (const name of [
    "dist",
    "packages/viewer/dist",
    "examples/basic/mokly-generated",
  ]) {
    const exists = await fs.lstat(path.join(root, name)).then(
      () => true,
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return false;
        throw error;
      },
    );
    if (exists)
      throw new Error(`Cold preview requires absent build output: ${name}`);
  }
  const signal = AbortSignal.timeout(FULL_CATALOGUE_SETUP_TIMEOUT_MS);
  const result = await (options.runner ?? new NodeBaselineProcessRunner()).run({
    argv: [
      "npm",
      "run",
      "preview:build",
      "--",
      "--out",
      output,
      ...(includeChanges ? ["--include-changes", "--base", "HEAD"] : []),
    ],
    cwd: root,
    signal,
    env: Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    ),
  });
  if (result.exitCode !== 0 || result.signal !== null)
    throw new Error(`Cold preview:build failed: ${result.output}`);
}
