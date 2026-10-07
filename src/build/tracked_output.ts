import path from "node:path";

import { GENERATED_DIRECTORY } from "@mokly/viewer/data";

import { MOKLY_CACHE } from "../config/cache_paths.js";
import { requireGitTopLevel } from "../config/git.js";
import { projectRealPath, toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError, errorMessage } from "../errors.js";
import type { GitCommandRunner } from "../review/git.js";

import type { Compilation } from "./compile.js";
import { insideGitWorkTree, type GitWorkTreeOptions } from "./git_work_tree.js";

export type GeneratedOutputTracking = "tracked" | "untracked";

/** Read index state for Check only; authored files in the catalogue do not count. */
export interface TrackedGeneratedOutput {
  state(
    compilation: Compilation,
    config: ResolvedConfig,
    indexedRoot?: (root: string) => void,
  ): Promise<GeneratedOutputTracking>;
}

export class GitTrackedGeneratedOutput implements TrackedGeneratedOutput {
  constructor(
    private readonly runner: GitCommandRunner,
    private readonly probe?: GitWorkTreeOptions,
  ) {}

  async state(
    compilation: Compilation,
    config: ResolvedConfig,
    indexedRoot?: (root: string) => void,
  ): Promise<GeneratedOutputTracking> {
    try {
      if (!(await insideGitWorkTree(config.repoRoot, this.runner, this.probe)))
        return "untracked";
      await requireGitTopLevel(config, this.runner);
      const prefixes = [
        ...new Set([
          toPosixPath(path.relative(config.repoRoot, config.generatedDir)),
          toPosixPath(
            path.relative(
              projectRealPath(config.repoRoot),
              path.join(
                projectRealPath(config.mockupsDir),
                GENERATED_DIRECTORY,
              ),
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
            )}\nRemove these paths from the index with git rm --cached.`,
        );
      const pathForRoute = (prefix: string, route: string) =>
        prefix ? `${prefix}/${route}` : route;
      const tracked = [...new Set(indexed)].filter((name) =>
        prefixes.some(
          (prefix) => name === prefix || name.startsWith(`${prefix}/`),
        ),
      );
      if (!tracked.length) return "untracked";
      const root = [...prefixes]
        .reverse()
        .find((prefix) =>
          tracked.some(
            (name) => name === prefix || name.startsWith(`${prefix}/`),
          ),
        )!;
      indexedRoot?.(root);
      const missing = [...compilation.outputs.keys()]
        .filter((route) =>
          prefixes.every(
            (prefix) => !tracked.includes(pathForRoute(prefix, route)),
          ),
        )
        .map((route) => pathForRoute(root, route))
        .sort();
      if (!missing.length) return "tracked";
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
        error instanceof MoklyError &&
        (error.code === "build-invalid" || error.code === "config-invalid")
      )
        throw error;
      throw new MoklyError(
        "build-invalid",
        `could not check tracked generated output: ${missingGit(error) ? "Git executable was not found; install Git and retry." : errorMessage(error)}`,
        { cause: error },
      );
    }
  }
}

function missingGit(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ENOENT" &&
    "syscall" in error &&
    error.syscall === "spawn git"
  );
}
