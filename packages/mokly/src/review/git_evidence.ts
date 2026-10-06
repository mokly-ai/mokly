import { timeAsync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";

import type { RepositoryEvidence } from "./git.js";
import { GitCommands } from "./git_commands.js";
import { assertGitPath } from "./git_path.js";

/** Repository changes and branch identity, independent of baseline storage. */
export class GitRepositoryEvidence
  extends GitCommands
  implements RepositoryEvidence
{
  async mergeBase(
    baseReference: string,
    headReference: string,
  ): Promise<string> {
    return timeAsync("review.base-commit", async () => {
      const output = await this.run(
        ["merge-base", "--", baseReference, headReference],
        `find merge base of ${baseReference} and ${headReference}`,
      );
      const commit = output.trim();
      if (!/^[a-f0-9]{40,64}$/.test(commit)) {
        throw new MoklyError(
          "git-failed",
          `Git returned an invalid merge base for ${baseReference} and ${headReference}`,
        );
      }
      return commit;
    });
  }

  async changedPaths(
    commit: string,
    excludedPaths: readonly string[] = [],
  ): Promise<readonly string[]> {
    excludedPaths = [...new Set([".mokly-cache", ...excludedPaths])];
    for (const excluded of excludedPaths) assertGitPath(excluded);
    const pathspecs = excludedPaths.map(
      (excluded) => `:(exclude,top,literal)${excluded}`,
    );
    const tracked = await this.run(
      ["diff", "--name-only", commit, "--", ...pathspecs],
      `diff workspace against ${commit}`,
    );
    const untracked = await this.run(
      ["ls-files", "--others", "--exclude-standard", "--", ...pathspecs],
      "list untracked workspace paths",
    );
    return [
      ...new Set(
        `${tracked}\n${untracked}`
          .split("\n")
          .map((value) => value.trim())
          .filter(
            (value) =>
              value.length > 0 &&
              !excludedPaths.some((excluded) => pathBelongsTo(value, excluded)),
          ),
      ),
    ].sort();
  }
}

function pathBelongsTo(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(`${root}/`);
}
