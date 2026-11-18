import path from "node:path";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";
import type { CaptureHint } from "../generated/sidecar/CaptureHint.js";

import type { CaptureKind } from "./capture-kind.js";
import { CapturePaths } from "./capture-paths.js";
import {
  captureRuntime,
  captureSnapshot,
  mature,
  maturityGuard,
  sameCaptureStat,
} from "./capture-runtime.js";
import type { CaptureRuntime, CaptureStat } from "./capture-runtime.js";
import { CaptureVolumes } from "./capture-volumes.js";
import { missingFile } from "./file-digests.js";

const VISITED_LIMIT = 8 * 1024 * 1024;
interface Witness {
  file: string;
  follow: boolean;
  stat: CaptureStat;
  metadata: boolean;
}

function* initialPaths(params: BundleParams): Generator<string> {
  yield params.sourceRoot;
  yield path.resolve(params.sourceRoot, params.configurationDirectory);
  for (const file of params.entryFiles)
    yield path.resolve(params.sourceRoot, file);
  for (const file of params.storiesFiles)
    yield path.resolve(params.sourceRoot, file);
  if (params.renderer) yield path.resolve(params.sourceRoot, params.renderer);
}

/** Ephemeral first-touch witnesses decide disk saves, never live reuse. */
export class CaptureDurability {
  private durable = true;
  private readonly witnesses = new Map<string, Witness>();
  private readonly paths: CapturePaths;
  private readonly volumes: CaptureVolumes;
  private readonly started: bigint;
  private visitedBytes = 0;
  private witnessBytes = 0;

  get bytes(): number {
    return this.witnessBytes + this.paths.bytes;
  }

  constructor(
    private readonly hint: CaptureHint,
    private readonly runtime: CaptureRuntime = captureRuntime,
  ) {
    this.started = runtime.now();
    this.volumes = new CaptureVolumes(hint, runtime);
    this.paths = new CapturePaths(
      runtime,
      (file, stat) => {
        this.observe(file, stat, false);
        return this.durable;
      },
      (bytes) =>
        this.durable && this.visitedBytes + this.bytes + bytes <= VISITED_LIMIT,
    );
    if (
      hint.volumes.length > 64 ||
      Buffer.byteLength(JSON.stringify(hint)) > 64 * 1024
    )
      this.durable = false;
  }

  /** Preflight is not evidence. No observation is retained across a wait. */
  preflight(params: BundleParams): bigint {
    const paths = new Set<string>();
    let bytes = 0;
    for (let file of initialPaths(params)) {
      for (;;) {
        if (paths.has(file)) break;
        bytes += Buffer.byteLength(file);
        if (bytes > VISITED_LIMIT) {
          this.reject();
          return 0n;
        }
        paths.add(file);
        const parent = path.dirname(file);
        if (parent === file) break;
        file = parent;
      }
    }
    let guard = 0n;
    for (const file of paths) {
      try {
        const stat = this.runtime.lstat(file);
        const limit = maturityGuard(stat);
        if (
          stat.ctimeNs > 0n &&
          stat.ctimeNs <= this.started &&
          this.started - stat.ctimeNs < limit &&
          limit > guard
        )
          guard = limit;
      } catch (error) {
        if (!missingFile(error)) this.durable = false;
      }
    }
    return guard;
  }

  /** A request can wait once, before prepare or any capture observation. */
  async prepare(params: BundleParams): Promise<void> {
    if (!this.durable) return;
    const guard = this.preflight(params);
    const remaining = this.started + 50_000_000n - this.runtime.now();
    if (guard && remaining > 0n)
      await this.runtime.wait(Number((remaining + 999_999n) / 1_000_000n));
  }

  /** Witness bytes share the visited-path budget without changing completeness. */
  budget(visitedBytes: number): void {
    this.visitedBytes = visitedBytes;
    if (visitedBytes + this.bytes > VISITED_LIMIT) this.reject();
  }

  private reject(): void {
    this.durable = false;
    this.witnesses.clear();
    this.witnessBytes = 0;
    this.paths.clear();
  }

  /** The physical owner already witnessed each borrowed directory kind. */
  sharePaths(kinds: ReadonlyMap<string, CaptureKind | undefined>): void {
    this.paths.share(kinds);
  }

  /** Topology failures affect disk storage only; physical readers keep their checks. */
  path(file: string): void {
    if (this.durable && !this.paths.walk(file)) this.reject();
  }

  /** Following a directory link adds a witness but cannot change completeness. */
  target(file: string): void {
    if (!this.durable) return;
    try {
      const stat = this.runtime.stat(file);
      if (stat.isDirectory()) this.observe(file, stat, true);
    } catch {
      this.reject();
    }
  }

  observe(
    file: string,
    stat: CaptureStat,
    follow: boolean,
    metadata = false,
  ): void {
    if (!this.durable) return;
    const key = JSON.stringify([file, follow]);
    if (this.witnesses.has(key)) return;
    const bytes = Buffer.byteLength(file) + 48;
    const touched = this.runtime.now();
    if (
      this.visitedBytes + this.bytes + bytes > VISITED_LIMIT ||
      !mature(stat, touched)
    ) {
      this.reject();
      return;
    }
    try {
      if (!metadata)
        stat = captureSnapshot(this.runtime, file, stat, follow, false);
      if (!this.volumes.supported(file, stat)) {
        this.reject();
        return;
      }
      this.witnessBytes += bytes;
      this.witnesses.set(key, { file, follow, stat, metadata });
    } catch {
      this.reject();
    }
  }

  /** Recheck stamps and current volume classes after all physical evidence. */
  finish(): boolean {
    if (!this.durable) return false;
    const volumes = new CaptureVolumes(this.hint, this.runtime);
    try {
      for (const witness of this.witnesses.values()) {
        const stat = witness.follow
          ? this.runtime.stat(witness.file)
          : this.runtime.lstat(witness.file);
        const actual = captureSnapshot(
          this.runtime,
          witness.file,
          stat,
          witness.follow,
          witness.metadata,
        );
        if (
          !sameCaptureStat(witness.stat, actual, witness.metadata) ||
          !volumes.supported(witness.file, actual)
        )
          return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}
