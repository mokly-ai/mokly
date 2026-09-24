import type { CompletionMarker } from "./cache_layout.js";
import type { BaselineError } from "./errors.js";

/** File metadata without following symbolic links. */
export interface BaselineStat {
  readonly kind: "directory" | "regular" | "symlink" | "other";
  readonly size: number;
  readonly identity: string;
}

/** The identity captured before publication; returning it transfers lock ownership. */
export interface BaselineLockIdentity {
  readonly identity: string;
}

/** Filesystem operations, including atomic lock publication and reclamation. */
export interface BaselineFileSystem {
  stat(file: string): Promise<BaselineStat | undefined>;
  list(directory: string): Promise<readonly string[]>;
  read(file: string, maxBytes: number): Promise<Uint8Array>;
  write(file: string, bytes: Uint8Array, mode?: number): Promise<void>;
  mkdir(directory: string): Promise<void>;
  remove(file: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  symlink(target: string, file: string): Promise<void>;
  /** Publish exclusively; cleanup cannot change ownership, contention, or the publication error. */
  acquireLock(
    file: string,
    bytes: Uint8Array,
  ): Promise<BaselineLockIdentity | undefined>;
  /** Reclaim this identity at most once, without unlinking a successor's lock. */
  reclaimLock(file: string, identity: string): Promise<boolean>;
}

/** Time and interruptible waiting, injected for deterministic lock tests. */
export interface BaselineClock {
  now(): number;
  sleep(milliseconds: number, signal?: AbortSignal): Promise<void>;
}

export interface BaselineProcessRequest {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly env: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
  /** Archive bytes are bounded separately from the diagnostic output tail. */
  readonly captureArchive?: boolean;
}

export interface BaselineProcessResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly output: string;
  readonly stdout: Uint8Array;
}

/** Process execution and lock-holder liveness belong to the host. */
export interface BaselineProcessRunner {
  readonly pid: number;
  isAlive(pid: number): boolean;
  run(request: BaselineProcessRequest): Promise<BaselineProcessResult>;
}

/** Observations for a caller that publishes baseline preparation state. */
export type BaselineProgress =
  | { readonly type: "start"; readonly commit: string }
  | {
      readonly type: "complete";
      readonly commit: string;
      readonly cacheHit: boolean;
    }
  | {
      readonly type: "fail";
      readonly commit: string;
      readonly error: BaselineError;
    };

export interface BaselineBuildRequest {
  readonly repoRoot: string;
  readonly commit: string;
  /** Requested/current repository-relative catalogue root (`.` at repo root). */
  readonly mockupsPath: string;
  readonly commands: readonly (readonly string[])[];
  readonly allowManifestV2?: boolean;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: BaselineProgress) => void;
}

export interface RebuiltBaseline {
  readonly commit: string;
  readonly outputDir: string;
  readonly marker: CompletionMarker;
  readonly cacheHit: boolean;
}

/** Prepare a committed source tree once; readers never invoke this on HTTP requests. */
export interface BaselineBuilder {
  build(request: BaselineBuildRequest): Promise<RebuiltBaseline>;
}
