import type { ResolvedConfig } from "../config/types.js";
import { timeAsync, timeSync } from "../diagnostics/timings.js";

import type { Compilation } from "./compile.js";
import {
  assertOutputLockHeld,
  withOutputLock,
  type OutputLock,
} from "./output_lock.js";
import {
  validateGeneratedInventory,
  validateGeneratedRoot,
  validateGeneratedOutputPaths,
} from "./output_paths.js";
import { assertSafeGeneratedTree } from "./reserved_tree.js";
import { replaceGeneratedTree } from "./transaction_tree.js";

/** Replace the complete generated tree; cancellation stops only lock waiting. */
export async function writeCompilation(
  compilation: Compilation,
  config: ResolvedConfig,
  signal?: AbortSignal,
): Promise<void> {
  return withOutputLock(config.repoRoot, signal ? { signal } : {}, (lock) =>
    writeLockedCompilation(lock, compilation, config),
  );
}

/** Validate, install and roll back one complete tree while the writer lock is held. */
async function writeLockedCompilation(
  lock: OutputLock,
  compilation: Compilation,
  config: ResolvedConfig,
): Promise<void> {
  assertOutputLockHeld(lock, config.repoRoot);
  return timeAsync("output.write", async () => {
    timeSync("output.validate-targets", () => {
      validateGeneratedRoot(config);
      assertSafeGeneratedTree(config);
      validateGeneratedOutputPaths(compilation.outputs.keys(), {
        ...config,
        sourceFiles: compilation.manifest.sourceFiles,
      });
      validateGeneratedInventory(compilation);
    });
    await replaceGeneratedTree(compilation, config.generatedDir);
    config.sourceFiles = compilation.manifest.sourceFiles;
  });
}
