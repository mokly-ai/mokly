/** Reset only this fixture's pinned entry, holding the same lock as a real builder. */
import { removePartialBaseline } from "../../packages/mokly/dist/baseline/cache.js";
import { cacheLayout } from "../../packages/mokly/dist/baseline/cache_layout.js";
import { SystemBaselineClock } from "../../packages/mokly/dist/baseline/clock.js";
import { ensureBaselineDirectory } from "../../packages/mokly/dist/baseline/confinement.js";
import { NodeBaselineFileSystem } from "../../packages/mokly/dist/baseline/filesystem.js";
import { tryBaselineLock } from "../../packages/mokly/dist/baseline/lock.js";
import { NodeBaselineProcessRunner } from "../../packages/mokly/dist/baseline/process.js";
import { ConfiguredGitCommandRunner } from "../../packages/mokly/dist/config/git.js";
import { GitRepositoryEvidence } from "../../packages/mokly/dist/review/git_evidence.js";

export async function resetFixtureBaseline(config, dependencies = {}) {
  const fs = dependencies.fs ?? new NodeBaselineFileSystem();
  const runner = dependencies.runner ?? new NodeBaselineProcessRunner();
  const clock = dependencies.clock ?? new SystemBaselineClock();
  const evidence =
    dependencies.evidence ??
    new GitRepositoryEvidence(new ConfiguredGitCommandRunner(config));
  const commit = await evidence.mergeBase(config.review.base, "HEAD");
  const layout = cacheLayout(config.repoRoot, commit);
  await ensureBaselineDirectory(fs, config.repoRoot, layout.entry);
  const lock = await tryBaselineLock(fs, runner, clock, layout);
  if (!lock)
    throw new Error(
      "Stop the fixture's active baseline builder before benchmarking",
    );
  try {
    await removePartialBaseline(fs, layout);
  } finally {
    await lock.release();
  }
}
