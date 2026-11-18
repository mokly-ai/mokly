import path from "node:path";

import type { CaptureRuntime, CaptureStat } from "./capture-runtime.js";

/** Raw link expansions keep every target-parent directory in the capture. */
export class CapturePaths {
  private readonly observations = new Map<
    string,
    Promise<string | undefined>
  >();
  private visitedBytes = 0;
  private expansionBytes = 0;

  constructor(
    private readonly runtime: CaptureRuntime,
    private readonly directory: (
      file: string,
      stat: CaptureStat,
    ) => Promise<boolean>,
    private readonly fits: (bytes: number) => boolean,
  ) {}

  get bytes(): number {
    return this.visitedBytes + this.expansionBytes;
  }

  clear(): void {
    this.observations.clear();
    this.visitedBytes = 0;
  }

  private read(file: string): Promise<string | undefined> {
    const existing = this.observations.get(file);
    if (existing) return existing;
    const bytes = Buffer.byteLength(file);
    if (!this.fits(bytes)) throw new Error("capture visited-path limit");
    this.visitedBytes += bytes;
    const observation = (async () => {
      const stat = await this.runtime.lstat(file);
      if (stat.isDirectory() && !(await this.directory(file, stat)))
        throw new Error("capture directory rejected");
      if (!stat.isSymbolicLink()) return undefined;
      const target = await this.runtime.readlink(file);
      const bytes = Buffer.byteLength(target);
      if (!this.fits(bytes)) throw new Error("capture visited-path limit");
      this.visitedBytes += bytes;
      return target;
    })();
    this.observations.set(file, observation);
    return observation;
  }

  async walk(file: string): Promise<boolean> {
    const paths = this.runtime.platform === "win32" ? path.win32 : path.posix;
    const separator = this.runtime.platform === "win32" ? /[\\/]+/ : /\/+/;
    const seen = new Set<string>();
    let stateBytes = 0;
    try {
      const absolute = paths.resolve(file);
      let current = paths.parse(absolute).root;
      let remaining = absolute.slice(current.length).split(separator);
      let index = 0;
      let expansions = 0;
      await this.read(current);
      while (index < remaining.length) {
        if (!this.fits(0)) return false;
        const component = remaining[index++]!;
        if (!component || component === ".") continue;
        if (component === "..") {
          current = paths.dirname(current);
          continue;
        }
        const selected = paths.join(current, component);
        const target = await this.read(selected);
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
          await this.read(current);
          remaining = [...target.slice(root.length).split(separator), ...tail];
        } else remaining = [...target.split(separator), ...tail];
      }
      return true;
    } catch {
      return false;
    } finally {
      this.expansionBytes -= stateBytes;
    }
  }
}
