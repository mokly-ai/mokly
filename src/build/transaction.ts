import type { ResolvedConfig } from "../config/types.js";
import { timeAsync, timeSync } from "../diagnostics/timings.js";

import type { Compilation } from "./compile.js";
import {
  validateGeneratedInventory,
  validateGeneratedOutputPaths,
} from "./output_paths.js";
import { replaceGeneratedTree } from "./transaction_tree.js";

/** Validate and replace only the disposable generated tree. */
export async function writeCompilation(
  compilation: Compilation,
  config: ResolvedConfig,
): Promise<void> {
  return timeAsync("output.write", async () => {
    timeSync("output.validate-targets", () => {
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
