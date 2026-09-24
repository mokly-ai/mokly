import path from "node:path";

import { MOKLY_CACHE } from "../config/cache_paths.js";
import { requireGitTopLevel } from "../config/git.js";
import { projectRealPath, toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError, errorMessage } from "../errors.js";
import type { GitCommandRunner } from "../review/git.js";

import type { Compilation } from "./compile.js";
import { GENERATED_DIRECTORY } from "./styles/routes.js";
import { trackedOwnedOutput } from "./tracked_ownership.js";

/** Git index boundary for derived output validation; it never writes generated files. */
export interface TrackedGeneratedOutput {
  check(compilation: Compilation, config: ResolvedConfig): Promise<void>;
}

export class GitTrackedGeneratedOutput implements TrackedGeneratedOutput {
  constructor(private readonly runner: GitCommandRunner) {}

  async check(compilation: Compilation, config: ResolvedConfig): Promise<void> {
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
      const tracked = (
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
      const generated = new Set(
        prefixes.flatMap((prefix) =>
          [...compilation.outputs.keys()].map((route) =>
            prefix ? `${prefix}/${route}` : route,
          ),
        ),
      );
      for (const name of await trackedOwnedOutput(
        this.runner,
        config,
        prefixes,
      ))
        generated.add(name);
      const invalid = [...new Set(tracked)]
        .filter(
          (name) =>
            generated.has(name) ||
            prefixes.some((prefix) =>
              name.startsWith(
                `${prefix ? `${prefix}/` : ""}${GENERATED_DIRECTORY}/`,
              ),
            ) ||
            name === MOKLY_CACHE ||
            name.startsWith(`${MOKLY_CACHE}/`),
        )
        .sort();
      if (!invalid.length) return;
      const reservedIgnoreRules = prefixes
        .filter((prefix) =>
          invalid.some((name) =>
            name.startsWith(
              `${prefix ? `${prefix}/` : ""}${GENERATED_DIRECTORY}/`,
            ),
          ),
        )
        .map(
          (prefix) => `/${prefix ? `${prefix}/` : ""}${GENERATED_DIRECTORY}/`,
        );
      throw new MoklyError(
        "build-invalid",
        `derived output must not be tracked by Git:\n${invalid.map((name) => `  - ${name}`).join("\n")}\nRemove these paths from the index with git rm --cached and add these rules to .gitignore:\n${[...new Set([...invalid.map((name) => `/${name}`), ...reservedIgnoreRules]), `/${MOKLY_CACHE}/`].join("\n")}`,
      );
    } catch (error) {
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
