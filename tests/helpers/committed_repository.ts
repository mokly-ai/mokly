import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

import { baselineCatalogue } from "../../dist/baseline/catalogue.js";
import { ConfiguredGitCommandRunner } from "../../dist/config/git.js";
import { toPosixPath } from "../../dist/config/paths.js";
import type { ResolvedConfig } from "../../dist/config/types.js";
import { CommittedBaselineReader } from "../../dist/review/committed.js";
import type { GitCommandRunner } from "../../dist/review/git.js";
import { GitRepositoryEvidence } from "../../dist/review/git_evidence.js";
import type { ReadOnlyReviewRepository } from "../../dist/review/repository.js";

/** Explicit Git-blob adapter for fixtures that committed generated output. */
export function committedReviewRepository(
  config: ResolvedConfig,
  runner: GitCommandRunner = new ConfiguredGitCommandRunner(config),
  commit = execFileSync("git", ["-C", config.repoRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
): ReadOnlyReviewRepository {
  const root =
    toPosixPath(path.relative(config.repoRoot, config.mockupsDir)) || ".";
  const generatedManifest =
    root === "."
      ? ".generated/mokly-manifest.json"
      : `${root}/.generated/mokly-manifest.json`;
  const lookup = spawnSync(
    "git",
    ["-C", config.repoRoot, "cat-file", "-e", `${commit}:${generatedManifest}`],
    { stdio: "ignore" },
  );
  if (lookup.error) throw lookup.error;
  const layout = lookup.status === 0 ? "generated-v6" : "legacy";
  const descriptor = baselineCatalogue(commit, root, layout);
  return {
    evidence: new GitRepositoryEvidence(runner),
    reader: new CommittedBaselineReader(runner, descriptor),
    descriptor,
  };
}
