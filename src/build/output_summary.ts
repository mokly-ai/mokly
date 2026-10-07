/** One generated-file count and invocation-relative summary for every writer. */
import path from "node:path";

import type { ResolvedConfig } from "../config/types.js";

import type { Compilation } from "./compile.js";

export interface GeneratedOutputSummary {
  readonly count: number;
  readonly directory: string;
  readonly plain: string;
  readonly rich: string;
}

export function generatedOutputSummary(
  compilation: Pick<Compilation, "outputs">,
  config: Pick<ResolvedConfig, "mockupsDir">,
  invocationDirectory: string,
): GeneratedOutputSummary {
  const count = compilation.outputs.size;
  const directory =
    path.relative(invocationDirectory, config.mockupsDir) || ".";
  return {
    count,
    directory,
    plain: `Generated ${count} Mokly files.\n`,
    rich: `Generated ${count} files in ${directory}`,
  };
}
