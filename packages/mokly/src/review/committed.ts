import { MoklyError } from "../errors.js";

import type { BaselineReader, GitFile, GitFileKind } from "./git.js";
import { readGitFiles } from "./git_batch.js";
import { GitCommands } from "./git_commands.js";
import { assertGitPath } from "./git_path.js";

/** Historical baseline bytes read from Git without executing consumer code. */
export class CommittedBaselineReader
  extends GitCommands
  implements BaselineReader
{
  async readFile(commit: string, repoRelativePath: string): Promise<string> {
    assertGitPath(repoRelativePath);
    return this.run(
      ["show", `${commit}:${repoRelativePath}`],
      `read ${repoRelativePath} at ${commit}`,
    );
  }

  async fileExists(commit: string, repoRelativePath: string): Promise<boolean> {
    return (await this.fileKind(commit, repoRelativePath)) !== "missing";
  }

  async fileKind(
    commit: string,
    repoRelativePath: string,
  ): Promise<GitFileKind> {
    assertGitPath(repoRelativePath);
    const output = await this.run(
      [
        "ls-tree",
        "--format=%(objectmode)",
        commit,
        "--",
        `:(literal)${repoRelativePath}`,
      ],
      `inspect ${repoRelativePath} at ${commit}`,
    );
    const modes = output
      .split("\n")
      .map((mode) => mode.trim())
      .filter(Boolean);
    if (modes.length === 0) return "missing";
    if (modes.length !== 1) {
      throw new MoklyError(
        "git-failed",
        `Git returned multiple entries for ${repoRelativePath}`,
      );
    }
    const mode = modes[0] ?? "";
    if (/^100[0-7]{3}$/.test(mode)) return "regular";
    if (mode === "120000") return "symlink";
    return "other";
  }

  async readFileBytes(
    commit: string,
    repoRelativePath: string,
  ): Promise<Uint8Array> {
    assertGitPath(repoRelativePath);
    return this.runBytes(
      ["show", `${commit}:${repoRelativePath}`],
      `read ${repoRelativePath} at ${commit}`,
    );
  }

  async readFiles(
    commit: string,
    repoRelativePaths: readonly string[],
  ): Promise<ReadonlyMap<string, GitFile>> {
    for (const repoRelativePath of repoRelativePaths) {
      assertGitPath(repoRelativePath);
    }
    if (this.runner.runBytesWithInput) {
      return readGitFiles(this.runner, commit, repoRelativePaths);
    }
    const files = new Map<string, GitFile>();
    for (const repoRelativePath of [...new Set(repoRelativePaths)].sort()) {
      const kind = await this.fileKind(commit, repoRelativePath);
      files.set(
        repoRelativePath,
        kind === "regular"
          ? {
              bytes: await this.readFileBytes(commit, repoRelativePath),
              kind,
            }
          : { kind },
      );
    }
    return files;
  }
}
