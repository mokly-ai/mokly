import { MoklyError, errorMessage } from "../errors.js";

import type { GitCommandRunner } from "./git.js";

/** Contextual failures shared by Git evidence and committed reads. */
export class GitCommands {
  constructor(protected readonly runner: GitCommandRunner) {}
  protected async run(
    arguments_: readonly string[],
    context: string,
  ): Promise<string> {
    try {
      return await this.runner.run(arguments_);
    } catch (error) {
      if (error instanceof MoklyError && error.code === "config-invalid")
        throw error;
      throw new MoklyError("git-failed", `${context}: ${errorMessage(error)}`, {
        cause: error,
      });
    }
  }

  protected async runBytes(
    arguments_: readonly string[],
    context: string,
  ): Promise<Uint8Array> {
    try {
      if (this.runner.runBytes) return await this.runner.runBytes(arguments_);
      return Buffer.from(await this.runner.run(arguments_), "utf8");
    } catch (error) {
      if (error instanceof MoklyError && error.code === "config-invalid")
        throw error;
      throw new MoklyError("git-failed", `${context}: ${errorMessage(error)}`, {
        cause: error,
      });
    }
  }
}
