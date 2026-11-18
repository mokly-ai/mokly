import path from "node:path";

import type { CaptureKind } from "./capture-kind.js";
import type { CaptureRuntime, CaptureStat } from "./capture-runtime.js";

interface Observation {
  target?: string;
  expansionBytes?: number;
}

/** Raw link expansions keep every target-parent directory in the capture. */
export class CapturePaths {
  private readonly observations = new Map<string, Observation>();
  private physical?: ReadonlyMap<string, CaptureKind | undefined>;
  private visitedBytes = 0;
  private expansionBytes = 0;

  constructor(
    private readonly runtime: CaptureRuntime,
    private readonly directory: (file: string, stat: CaptureStat) => boolean,
    private readonly fits: (bytes: number) => boolean,
  ) {}

  get bytes(): number {
    return this.visitedBytes + this.expansionBytes;
  }

  clear(): void {
    this.observations.clear();
    this.visitedBytes = 0;
  }

  share(kinds: ReadonlyMap<string, CaptureKind | undefined>): void {
    this.physical = kinds;
  }

  private read(file: string): string | undefined {
    const existing = this.observations.get(file);
    if (existing) return existing.target;
    const bytes = Buffer.byteLength(file);
    if (!this.fits(bytes)) throw new Error("capture visited-path limit");
    this.visitedBytes += bytes;
    const kind = this.physical?.get(file);
    if (kind === "absent") throw new Error("capture path is absent");
    const stat = kind === undefined ? this.runtime.lstat(file) : undefined;
    if (stat?.isDirectory() && !this.directory(file, stat))
      throw new Error("capture directory rejected");
    let target: string | undefined;
    if (kind === "link" || stat?.isSymbolicLink()) {
      target = this.runtime.readlink(file);
      const bytes = Buffer.byteLength(target);
      if (!this.fits(bytes)) throw new Error("capture visited-path limit");
      this.visitedBytes += bytes;
    }
    this.observations.set(file, target === undefined ? {} : { target });
    return target;
  }

  walk(file: string): boolean {
    const paths = this.runtime.platform === "win32" ? path.win32 : path.posix;
    const separator = this.runtime.platform === "win32" ? /[\\/]+/ : /\/+/;
    const seen = new Set<string>();
    let stateBytes = 0;
    try {
      const absolute = paths.resolve(file);
      const existing = this.observations.get(absolute);
      if (existing?.expansionBytes !== undefined)
        return this.fits(existing.expansionBytes);
      let current = paths.parse(absolute).root;
      let remaining = absolute.slice(current.length).split(separator);
      let index = 0;
      let expansions = 0;
      this.read(current);
      while (index < remaining.length) {
        if (!this.fits(0)) return false;
        const component = remaining[index++]!;
        if (!component || component === ".") continue;
        if (component === "..") {
          current = paths.dirname(current);
          continue;
        }
        const selected = paths.join(current, component);
        const target = this.read(selected);
        if (target === undefined) {
          current = selected;
          continue;
        }
        const tail = remaining.slice(index);
        const state = JSON.stringify([selected, tail]);
        const bytes = Buffer.byteLength(state);
        if (++expansions > 255 || seen.has(state) || !this.fits(bytes))
          return false;
        seen.add(state);
        this.expansionBytes += bytes;
        stateBytes += bytes;
        index = 0;
        const root = paths.parse(target).root;
        if (paths.isAbsolute(target)) {
          current = paths.parse(paths.resolve(current, target)).root;
          this.read(current);
          remaining = [...target.slice(root.length).split(separator), ...tail];
        } else remaining = [...target.split(separator), ...tail];
      }
      const observation = this.observations.get(absolute);
      if (observation) observation.expansionBytes = stateBytes;
      return true;
    } catch {
      return false;
    } finally {
      this.expansionBytes -= stateBytes;
    }
  }
}
