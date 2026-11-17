import path from "node:path";

import type { CaptureHint } from "../generated/sidecar/CaptureHint.js";

import type { CaptureRuntime, CaptureStat } from "./capture-runtime.js";

const linuxTypes = new Set([
  0xef53n,
  0x58465342n,
  0x9123683en,
  0x01021994n,
  0x794c7630n,
]);

function localWindowsPath(file: string): string | undefined {
  const value = file.replaceAll("/", "\\").replace(/^\\\\\?\\/, "");
  return /^[a-z]:\\/i.test(value)
    ? path.win32.normalize(value).toLowerCase()
    : undefined;
}

/** A fresh instance rechecks each observed device's class at the finish boundary. */
export class CaptureVolumes {
  private readonly devices = new Map<string, Promise<boolean>>();

  constructor(
    private readonly hint: CaptureHint,
    private readonly runtime: CaptureRuntime,
  ) {}

  async supported(file: string, stat: CaptureStat): Promise<boolean> {
    const dev = String(stat.dev);
    if (this.runtime.platform === "win32") {
      const selected = localWindowsPath(file);
      return (
        selected !== undefined &&
        this.hint.volumes.some(
          (volume) =>
            volume.kind === "windows" &&
            volume.dev === dev &&
            volume.roots.some((root) => {
              const value = localWindowsPath(root);
              if (!value) return false;
              const prefix = value.endsWith("\\") ? value : value + "\\";
              return selected === value || selected.startsWith(prefix);
            }),
        )
      );
    }
    let known = this.devices.get(dev);
    if (!known) {
      known = (async () => {
        const type = await this.runtime.filesystem(file);
        return this.runtime.platform === "linux"
          ? linuxTypes.has(type)
          : this.runtime.platform === "darwin" &&
              this.hint.volumes.some(
                (volume) =>
                  volume.kind === "macos" &&
                  volume.dev === dev &&
                  BigInt(volume.fsType) === type,
              );
      })().catch(() => false);
      this.devices.set(dev, known);
    }
    return known;
  }
}
