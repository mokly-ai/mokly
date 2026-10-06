import path from "node:path";

import { errorMessage } from "../errors.js";

import { parseBaselineArchive } from "./archive.js";
import { ensureBaselineDirectory } from "./confinement.js";
import { assertBaselineActive, BaselineError } from "./errors.js";
import type { BaselineFileSystem, BaselineProcessRunner } from "./types.js";

/** Extract a trusted commit without a checkout or writes through archive aliases. */
export async function extractBaseline(
  fs: BaselineFileSystem,
  runner: BaselineProcessRunner,
  repoRoot: string,
  commit: string,
  source: string,
  env: Readonly<Record<string, string>>,
  signal?: AbortSignal,
): Promise<void> {
  try {
    assertBaselineActive(signal);
    const options = { cwd: repoRoot, env, ...(signal ? { signal } : {}) };
    const history = await runner.run({
      ...options,
      argv: ["git", "cat-file", "-e", `${commit}^{commit}`],
    });
    assertBaselineActive(signal);
    if (history.exitCode !== 0)
      throw new BaselineError(
        "baseline-history-unavailable",
        `Baseline history is unavailable for ${commit}: ${history.output}`,
      );
    const archive = await runner.run({
      ...options,
      argv: ["git", "archive", "--format=tar", commit],
      captureArchive: true,
    });
    assertBaselineActive(signal);
    if (archive.exitCode !== 0)
      throw new Error(`Git archive failed: ${archive.output}`);
    const entries = await parseBaselineArchive(archive.stdout);
    await fs.mkdir(source);
    for (const entry of entries) {
      assertBaselineActive(signal);
      const target = path.join(source, entry.path);
      await ensureBaselineDirectory(
        fs,
        source,
        entry.kind === "directory" ? target : path.dirname(target),
        signal,
      );
      if (entry.kind === "file")
        await fs.write(target, entry.bytes, entry.mode);
    }
    for (const entry of entries) {
      assertBaselineActive(signal);
      if (entry.kind === "symlink")
        await fs.symlink(entry.target!, path.join(source, entry.path));
    }
  } catch (error) {
    assertBaselineActive(signal);
    if (error instanceof BaselineError) throw error;
    throw new BaselineError(
      "baseline-extraction-failed",
      `Could not extract ${commit}: ${errorMessage(error)}`,
      error,
    );
  }
}
