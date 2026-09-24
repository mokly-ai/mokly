import type { BaselineCatalogue } from "../baseline/catalogue.js";

import { CommittedBaselineReader } from "./committed.js";
import { GitRepositoryEvidence } from "./git_evidence.js";
import { executeGit } from "./git_process.js";
import type { ReadOnlyReviewRepository } from "./repository.js";

/** Repository object classification used before reading Review dependencies. */
export type GitFileKind = "missing" | "other" | "regular" | "symlink";

/** A requested Git tree entry, with bytes retained only for regular files. */
export type GitFile =
  | { readonly bytes: Uint8Array; readonly kind: "regular" }
  | { readonly kind: Exclude<GitFileKind, "regular"> };

/** Branch identity and working-tree changes, independent of baseline bytes. */
export interface RepositoryEvidence {
  mergeBase(baseReference: string, headReference: string): Promise<string>;
  changedPaths(
    commit: string,
    excludedPaths?: readonly string[],
  ): Promise<readonly string[]>;
}

/** Historical files addressed by commit and repository-relative path. */
export interface BaselineReader {
  readonly catalogue?: BaselineCatalogue | undefined;
  fileExists(commit: string, repoRelativePath: string): Promise<boolean>;
  fileKind(commit: string, repoRelativePath: string): Promise<GitFileKind>;
  readFile(commit: string, repoRelativePath: string): Promise<string>;
  readFileBytes(commit: string, repoRelativePath: string): Promise<Uint8Array>;
  readFiles?(
    commit: string,
    repoRelativePaths: readonly string[],
  ): Promise<ReadonlyMap<string, GitFile>>;
}

/** Composition for catalogues that retain generated output in Git. */
export class CommittedRepository implements ReadOnlyReviewRepository {
  readonly evidence: GitRepositoryEvidence;
  readonly reader: CommittedBaselineReader;
  constructor(runner: GitCommandRunner) {
    this.evidence = new GitRepositoryEvidence(runner);
    this.reader = new CommittedBaselineReader(runner);
  }
}

/** Injected subprocess runner for Git commands. */
export interface GitCommandRunner {
  run(arguments_: readonly string[]): Promise<string>;
  runBytes?(arguments_: readonly string[]): Promise<Uint8Array>;
  runBytesWithInput?(
    arguments_: readonly string[],
    input: Uint8Array,
  ): Promise<Uint8Array>;
}

/** Operating-system Git subprocess implementation. */
export class NodeGitCommandRunner implements GitCommandRunner {
  constructor(
    private readonly cwd: string,
    private readonly signal?: AbortSignal,
  ) {}

  async run(arguments_: readonly string[]): Promise<string> {
    return Buffer.from(await this.runBytes(arguments_)).toString("utf8");
  }

  runBytes(arguments_: readonly string[]): Promise<Uint8Array> {
    return executeGit(this.cwd, arguments_, this.signal);
  }

  runBytesWithInput(
    arguments_: readonly string[],
    input: Uint8Array,
  ): Promise<Uint8Array> {
    return executeGit(this.cwd, arguments_, this.signal, input);
  }
}
