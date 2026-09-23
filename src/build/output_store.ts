import type { ResolvedConfig } from "../config/types.js";
import { NodeGitCommandRunner } from "../review/git.js";

import { checkCompilation } from "./check.js";
import type { Compilation } from "./compile.js";
import {
  GitTrackedGeneratedOutput,
  type GeneratedOutputTracking,
  type TrackedGeneratedOutput,
} from "./tracked_output.js";
import { writeCompilation } from "./transaction.js";

/** Filesystem boundary for generated catalogue snapshots. */
export interface GeneratedOutputStore {
  check(
    compilation: Compilation,
    config: ResolvedConfig,
  ): GeneratedOutputTracking | void | Promise<GeneratedOutputTracking | void>;
  write(compilation: Compilation, config: ResolvedConfig): Promise<void>;
}

/** Transactional operating-system generated-output store. */
export class FileSystemGeneratedOutputStore implements GeneratedOutputStore {
  constructor(private readonly tracked?: TrackedGeneratedOutput) {}

  async check(
    compilation: Compilation,
    config: ResolvedConfig,
  ): Promise<GeneratedOutputTracking> {
    const state = await (
      this.tracked ??
      new GitTrackedGeneratedOutput(new NodeGitCommandRunner(config.repoRoot))
    ).state(compilation, config);
    if (state === "tracked") checkCompilation(compilation, config);
    return state;
  }

  write(compilation: Compilation, config: ResolvedConfig): Promise<void> {
    return writeCompilation(compilation, config);
  }
}
