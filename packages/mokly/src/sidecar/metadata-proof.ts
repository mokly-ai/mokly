import path from "node:path";

import { CapturePaths } from "./capture-paths.js";
import {
  captureRuntime,
  captureSnapshot,
  mature,
  sameCaptureStat,
} from "./capture-runtime.js";
import type { CaptureRuntime, CaptureStat } from "./capture-runtime.js";
import { missingFile } from "./file-digests.js";

export interface MetadataFact {
  file: string;
  regular: boolean;
}

export const metadataRuntime: CaptureRuntime = { ...captureRuntime };
const BYTE_LIMIT = 8 * 1024 * 1024;

/** Only metadata used by accepted native edges enters this request-local proof. */
export class MetadataProof {
  private readonly facts = new Map<string, boolean>();
  private bytes = 0;
  private complete = true;

  constructor(
    private readonly started: bigint,
    private readonly runtime: CaptureRuntime = metadataRuntime,
  ) {}

  use(facts: Iterable<MetadataFact>): void {
    for (const { file, regular } of facts) {
      const previous = this.facts.get(file);
      if (previous !== undefined) {
        if (previous !== regular) this.complete = false;
        continue;
      }
      this.bytes += Buffer.byteLength(file) + 1;
      if (this.bytes > BYTE_LIMIT) {
        this.complete = false;
        return;
      }
      this.facts.set(file, regular);
    }
  }

  /** Run after the last scope read; age proves stability without precompile pairs. */
  current(): boolean {
    if (!this.complete) return false;
    const links = new Map<string, CaptureStat>();
    const runtime: CaptureRuntime = {
      ...this.runtime,
      lstat: (file) => {
        const stat = this.runtime.lstat(file);
        if (stat.isSymbolicLink()) {
          if (!mature(stat, this.started))
            throw new Error("young metadata link");
          links.set(file, stat);
        }
        return stat;
      },
      readlink: (file) => {
        const target = this.runtime.readlink(file);
        const before = links.get(file);
        const after = this.runtime.lstat(file);
        if (!before || !sameCaptureStat(before, after, false))
          throw new Error("metadata link changed while reading");
        return target;
      },
    };
    const paths: CapturePaths = new CapturePaths(
      runtime,
      (file, stat) =>
        mature(
          captureSnapshot(this.runtime, file, stat, false, false),
          this.started,
        ),
      (bytes) => this.bytes + paths.bytes + bytes <= BYTE_LIMIT,
    );
    try {
      for (const [file, regular] of this.facts) {
        if (!paths.walk(path.dirname(file))) return false;
        let stat: CaptureStat;
        try {
          stat = this.runtime.stat(file);
        } catch (error) {
          if (!regular && missingFile(error)) {
            try {
              this.runtime.lstat(file);
            } catch (lexical) {
              if (missingFile(lexical)) continue;
            }
          }
          return false;
        }
        if (stat.isFile() !== regular || !paths.walk(file)) return false;
        if (regular) {
          stat = captureSnapshot(this.runtime, file, stat, true, true);
          if (!mature(stat, this.started)) return false;
        } else if (!stat.isDirectory()) return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}
