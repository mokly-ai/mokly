import path from "node:path";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";
import type { CaptureHint } from "../generated/sidecar/CaptureHint.js";

import { captureRuntime, mature, maturityGuard } from "./capture-runtime.js";
import type { CaptureRuntime, CaptureStat } from "./capture-runtime.js";
import { CaptureVolumes } from "./capture-volumes.js";
import { everyInput, missingFile } from "./file-digests.js";

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
  private readonly volumes: CaptureVolumes;
  private readonly started: bigint;
  private visitedBytes = 0;
  bytes = 0;

  constructor(
    private readonly hint: CaptureHint,
    private readonly runtime: CaptureRuntime = captureRuntime,
  ) {
    this.started = runtime.now();
    this.volumes = new CaptureVolumes(hint, runtime);
    if (
      hint.volumes.length > 64 ||
      Buffer.byteLength(JSON.stringify(hint)) > 64 * 1024
    )
      this.durable = false;
  }

  /** Preflight is not evidence. No observation is retained across a wait. */
  async preflight(params: BundleParams): Promise<bigint> {
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
        const stat = await this.runtime.lstat(file);
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
    const guard = await this.preflight(params);
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
    this.bytes = 0;
  }

  /** Following a directory link adds a witness but cannot change completeness. */
  async target(file: string): Promise<void> {
    if (!this.durable) return;
    try {
      const stat = await this.runtime.stat(file);
      if (stat.isDirectory()) await this.observe(file, stat, true);
    } catch {
      this.reject();
    }
  }

  async observe(
    file: string,
    stat: CaptureStat,
    follow: boolean,
    metadata = false,
  ): Promise<void> {
    if (!this.durable) return;
    const key = JSON.stringify([file, follow]);
    if (this.witnesses.has(key)) return;
    const bytes = Buffer.byteLength(file) + 48;
    if (
      this.visitedBytes + this.bytes + bytes > VISITED_LIMIT ||
      !mature(stat, this.runtime.now()) ||
      !(await this.volumes.supported(file, stat))
    ) {
      this.reject();
      return;
    }
    this.bytes += bytes;
    this.witnesses.set(key, { file, follow, stat, metadata });
  }

  /** Recheck stamps and current volume classes after all physical evidence. */
  async finish(): Promise<boolean> {
    if (!this.durable) return false;
    const volumes = new CaptureVolumes(this.hint, this.runtime);
    return everyInput([...this.witnesses.values()], async (witness) => {
      const actual = await (witness.follow
        ? this.runtime.stat(witness.file)
        : this.runtime.lstat(witness.file));
      const before = witness.stat;
      return (
        actual.dev === before.dev &&
        actual.ino === before.ino &&
        actual.ctimeNs === before.ctimeNs &&
        actual.mtimeNs === before.mtimeNs &&
        (!witness.metadata || actual.size === before.size) &&
        (await volumes.supported(witness.file, actual))
      );
    });
  }
}
