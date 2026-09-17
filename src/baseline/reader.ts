import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { errorMessage } from "../errors.js";
import type { BaselineReader, GitFile, GitFileKind } from "../review/git.js";
import {
  MAX_BATCH_OUTPUT_BYTES,
  MAX_BLOBS_PER_BATCH,
} from "../review/git_batch.js";

import { confinedBaselineStat } from "./confinement.js";
import { assertBaselineActive, BaselineError } from "./errors.js";
import type { BaselineFileSystem, BaselineStat } from "./types.js";

/** Read an already completed tree; this boundary never runs a build or follows links. */
export class RebuiltBaselineReader implements BaselineReader {
  constructor(
    private readonly fs: BaselineFileSystem,
    private readonly repoRoot: string,
    private readonly outputDir: string,
    private readonly commit: string,
    private readonly mockupsPath: string,
    private readonly signal?: AbortSignal,
  ) {}

  async fileExists(commit: string, repoPath: string): Promise<boolean> {
    return (await this.fileKind(commit, repoPath)) !== "missing";
  }

  async fileKind(commit: string, repoPath: string): Promise<GitFileKind> {
    try {
      return kind(await this.inspect(commit, repoPath));
    } catch (error) {
      assertBaselineActive(this.signal);
      if (error instanceof BaselineError) throw error;
      throw new BaselineError(
        "baseline-output-invalid",
        `Could not inspect rebuilt baseline: ${errorMessage(error)}`,
        error,
      );
    }
  }

  async readFile(commit: string, repoPath: string): Promise<string> {
    return Buffer.from(await this.readFileBytes(commit, repoPath)).toString(
      "utf8",
    );
  }

  async readFileBytes(commit: string, repoPath: string): Promise<Uint8Array> {
    const file = (await this.readFiles(commit, [repoPath])).get(repoPath);
    if (file?.kind !== "regular")
      throw new BaselineError(
        "baseline-output-invalid",
        `Not a regular baseline file (${file?.kind ?? "missing"}): ${repoPath}`,
      );
    return file.bytes;
  }

  async readFiles(
    commit: string,
    repoPaths: readonly string[],
  ): Promise<ReadonlyMap<string, GitFile>> {
    try {
      const files = new Map<string, GitFile>();
      const paths = [...new Set(repoPaths)].sort();
      let batch: { path: string; size: number }[] = [];
      let bytes = 0;
      const flush = async () => {
        for (let offset = 0; offset < batch.length; offset += 32) {
          await Promise.all(
            batch.slice(offset, offset + 32).map(async (file) => {
              assertBaselineActive(this.signal);
              const stat = await this.inspect(commit, file.path);
              if (stat?.kind !== "regular" || stat.size !== file.size)
                throw new Error(
                  `Baseline file changed during read: ${file.path}`,
                );
              const content = await this.fs.read(
                this.resolve(commit, file.path),
                file.size,
              );
              if (content.byteLength !== file.size)
                throw new Error(
                  `Baseline file changed during read: ${file.path}`,
                );
              files.set(file.path, { kind: "regular", bytes: content });
            }),
          );
        }
        batch = [];
        bytes = 0;
      };
      for (const repoPath of paths) {
        const stat = await this.inspect(commit, repoPath);
        if (stat?.kind !== "regular") {
          files.set(repoPath, {
            kind: kind(stat) as Exclude<GitFileKind, "regular">,
          });
          continue;
        }
        const outputBytes =
          stat.size +
          Buffer.byteLength(`${this.commit} blob ${stat.size}\n`) +
          1;
        if (outputBytes > MAX_BATCH_OUTPUT_BYTES)
          throw new Error(
            `Baseline file ${repoPath} is too large for a bounded batch (${stat.size} bytes)`,
          );
        if (
          batch.length >= MAX_BLOBS_PER_BATCH ||
          bytes + outputBytes > MAX_BATCH_OUTPUT_BYTES
        )
          await flush();
        batch.push({ path: repoPath, size: stat.size });
        bytes += outputBytes;
      }
      await flush();
      assertBaselineActive(this.signal);
      return new Map(paths.map((file) => [file, files.get(file)!]));
    } catch (error) {
      assertBaselineActive(this.signal);
      if (error instanceof BaselineError) throw error;
      throw new BaselineError(
        "baseline-output-invalid",
        `Could not read rebuilt baseline: ${errorMessage(error)}`,
        error,
      );
    }
  }

  private async inspect(
    commit: string,
    repoPath: string,
  ): Promise<BaselineStat | undefined> {
    this.resolve(commit, repoPath);
    return confinedBaselineStat(
      this.fs,
      this.repoRoot,
      path
        .relative(this.repoRoot, this.resolve(commit, repoPath))
        .split(path.sep)
        .join("/"),
      this.signal,
    );
  }

  private resolve(commit: string, repoPath: string): string {
    if (
      commit !== this.commit ||
      !isSafeRepositoryPath(repoPath) ||
      !repoPath.startsWith(`${this.mockupsPath}/`)
    )
      throw new BaselineError(
        "baseline-output-invalid",
        `Path or commit is outside the prepared baseline: ${repoPath}`,
      );
    return path.join(
      this.outputDir,
      repoPath.slice(this.mockupsPath.length + 1),
    );
  }
}

function kind(stat?: BaselineStat): GitFileKind {
  return !stat ? "missing" : stat.kind === "directory" ? "other" : stat.kind;
}
