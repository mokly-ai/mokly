import path from "node:path";

import { MOKLY_CACHE } from "../config/cache_paths.js";
import { requireGitTopLevel } from "../config/git.js";
import { projectRealPath, toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError, errorMessage } from "../errors.js";
import type { GitCommandRunner } from "../review/git.js";
import { GitProcessError } from "../review/git_process.js";

import type { Compilation } from "./compile.js";

export type GeneratedOutputTracking = "tracked" | "untracked";

/** Read index state for Check only; authored files in the catalogue do not count. */
export interface TrackedGeneratedOutput {
  state(
    compilation: Compilation,
    config: ResolvedConfig,
  ): Promise<GeneratedOutputTracking>;
}

export class GitTrackedGeneratedOutput implements TrackedGeneratedOutput {
  constructor(private readonly runner: GitCommandRunner) {}

  async state(
    compilation: Compilation,
    config: ResolvedConfig,
  ): Promise<GeneratedOutputTracking> {
    try {
      await requireGitTopLevel(config, this.runner);
      const prefixes = [
        ...new Set([
          toPosixPath(path.relative(config.repoRoot, config.mockupsDir)),
          toPosixPath(
            path.relative(
              projectRealPath(config.repoRoot),
              projectRealPath(config.mockupsDir),
            ),
          ),
        ]),
      ];
      const indexed = (
        await this.runner.run([
          "ls-files",
          "--cached",
          "--full-name",
          "-z",
          "--",
          ...[...prefixes, MOKLY_CACHE].map(
            (prefix) => `:(top,literal)${prefix}`,
          ),
        ])
      )
        .split("\0")
        .filter(Boolean);
      const cache = indexed.filter(
        (name) => name === MOKLY_CACHE || name.startsWith(`${MOKLY_CACHE}/`),
      );
      if (cache.length)
        throw new MoklyError(
          "build-invalid",
          `baseline cache must not be tracked by Git:\n${cache
            .sort()
            .map((name) => `  - ${name}`)
            .join(
              "\n",
            )}\nRemove these paths from the index with git rm --cached and add /${MOKLY_CACHE}/ to .gitignore.`,
        );
      const pathForRoute = (prefix: string, route: string) =>
        prefix ? `${prefix}/${route}` : route;
      const expected = new Set(
        prefixes.flatMap((prefix) =>
          [...compilation.outputs.keys()].map((route) =>
            pathForRoute(prefix, route),
          ),
        ),
      );
      const tracked = [...new Set(indexed)].filter((name) =>
        expected.has(name),
      );
      if (!tracked.length) return "untracked";
      const missing = [...compilation.outputs.keys()]
        .filter((route) =>
          prefixes.every(
            (prefix) => !tracked.includes(pathForRoute(prefix, route)),
          ),
        )
        .map((route) => pathForRoute(prefixes[0]!, route))
        .sort();
      if (!missing.length) return "tracked";
      const root = prefixes[0] || ".";
      throw new MoklyError(
        "build-invalid",
        `generated output is partly tracked by Git:\ntracked:\n${tracked
          .sort()
          .map((name) => `  - ${name}`)
          .join(
            "\n",
          )}\nuntracked:\n${missing.map((name) => `  - ${name}`).join("\n")}\nRun mokly build and commit every file under ${root}/, or run git rm -r --cached -- ${root}/ and add /${root}/ to .gitignore.`,
      );
    } catch (error) {
      if (
        error instanceof GitProcessError &&
        error.exitCode === 128 &&
        /not a git repository/i.test(error.message)
      )
        return "untracked";
      if (
        error instanceof MoklyError &&
        (error.code === "build-invalid" || error.code === "config-invalid")
      )
        throw error;
      throw new MoklyError(
        "build-invalid",
        `could not check tracked generated output: ${errorMessage(error)}`,
        { cause: error },
      );
    }
  }
}
