import { MoklyError } from "../errors.js";
import { NodeGitCommandRunner, type GitCommandRunner } from "../review/git.js";

import { projectRealPath } from "./paths.js";
import type { ResolvedConfig } from "./types.js";

type RepositoryConfig = Pick<ResolvedConfig, "repoRoot">;

/** Validate the repository-relative path contract only when Git is required. */
export async function requireGitTopLevel(
  config: RepositoryConfig,
  runner: GitCommandRunner,
): Promise<void> {
  const root = (await runner.run(["rev-parse", "--show-toplevel"])).trim();
  if (projectRealPath(root) !== projectRealPath(config.repoRoot))
    throw new MoklyError(
      "config-invalid",
      `repoRoot must be the Git top level: configured ${config.repoRoot}, Git reports ${root}`,
    );
}

/** Defer Git validation until the first read, sharing it across concurrent reads. */
export class ConfiguredGitCommandRunner implements GitCommandRunner {
  private validation: Promise<void> | undefined;
  readonly runBytesWithInput?: NonNullable<
    GitCommandRunner["runBytesWithInput"]
  >;

  constructor(
    private readonly config: RepositoryConfig,
    signal?: AbortSignal,
    private readonly runner: GitCommandRunner = new NodeGitCommandRunner(
      config.repoRoot,
      signal,
    ),
  ) {
    if (runner.runBytesWithInput)
      this.runBytesWithInput = async (args, input) => {
        await this.requireTopLevel();
        return runner.runBytesWithInput!(args, input);
      };
  }

  requireTopLevel(): Promise<void> {
    this.validation ??= requireGitTopLevel(this.config, this.runner).catch(
      (error: unknown) => {
        this.validation = undefined;
        throw error;
      },
    );
    return this.validation;
  }

  async run(args: readonly string[]): Promise<string> {
    await this.requireTopLevel();
    return this.runner.run(args);
  }

  async runBytes(args: readonly string[]): Promise<Uint8Array> {
    await this.requireTopLevel();
    return this.runner.runBytes
      ? this.runner.runBytes(args)
      : Buffer.from(await this.runner.run(args), "utf8");
  }
}
