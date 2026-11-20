import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { PhysicalEntry } from "../generated/sidecar/PhysicalEntry.js";
import type { PhysicalInput } from "../generated/sidecar/PhysicalInput.js";
import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import type { CaptureDurability } from "./capture-durability.js";
import { captureKind } from "./capture-kind.js";
import type { CaptureKind } from "./capture-kind.js";
import { missingFile } from "./file-digests.js";
import { lexicalLinkTarget } from "./physical-link-target.js";

export const EVIDENCE_LIMIT = 8 * 1024 * 1024;
const METADATA_FILE_LIMIT = 1024 * 1024;

export interface CapturedMetadata {
  input: PhysicalInput;
  bytes?: Buffer;
}

export type FilePathProbe =
  { kind: "file"; path: string } | { kind: "absent" } | { kind: "other" };

/** Protected filesystem primitives of the one PhysicalInputs owner. */
export class PhysicalInputReader {
  complete = true;
  protected metadataBytes = 0;
  protected readonly pathKinds = new Map<string, CaptureKind | undefined>();

  constructor(protected readonly durability?: CaptureDurability) {
    durability?.sharePaths(this.pathKinds);
  }

  private kind(file: string, known?: CaptureKind): CaptureKind {
    return known && known !== "link"
      ? known
      : captureKind(fs.statSync(file, { throwIfNoEntry: false }));
  }

  protected readMetadata(file: string, known?: CaptureKind): CapturedMetadata {
    let handle;
    try {
      if (this.kind(file, known) === "absent")
        return { input: { kind: "absent" } };
      handle = fs.openSync(file, "r");
    } catch (error) {
      if (missingFile(error)) return { input: { kind: "absent" } };
      throw error;
    }
    try {
      const metadata = fs.fstatSync(handle, { bigint: true });
      if (
        !metadata.isFile() ||
        metadata.size > BigInt(METADATA_FILE_LIMIT) ||
        BigInt(this.metadataBytes) + metadata.size > BigInt(EVIDENCE_LIMIT)
      )
        throw new Error("metadata evidence limit");
      this.durability?.observe(file, metadata, true, true);
      const size = Number(metadata.size);
      this.metadataBytes += size;
      const bytes = Buffer.alloc(size);
      let length = 0;
      while (length < bytes.length) {
        const read = fs.readSync(
          handle,
          bytes,
          length,
          bytes.length - length,
          null,
        );
        if (!read) break;
        length += read;
      }
      if (
        length !== bytes.length ||
        fs.fstatSync(handle, { bigint: true }).size !== BigInt(bytes.length)
      )
        throw new Error("metadata changed during capture");
      return {
        input: {
          kind: "file",
          digest: createHash("sha256").update(bytes).digest("hex"),
        },
        bytes,
      };
    } finally {
      fs.closeSync(handle);
    }
  }

  protected realPath(file: string): string {
    this.durability?.path(file);
    return fs.realpathSync.native(file);
  }

  protected readDirectoryPath(
    file: string,
    known?: CaptureKind,
  ): string | undefined {
    return this.kind(file, known) === "directory"
      ? this.realPath(file)
      : undefined;
  }

  protected readFilePath(file: string, known?: CaptureKind): FilePathProbe {
    try {
      const kind = this.kind(file, known);
      if (kind === "absent") return { kind: "absent" };
      return kind === "file"
        ? { kind: "file", path: this.realPath(file) }
        : { kind: "other" };
    } catch (error) {
      if (missingFile(error)) return { kind: "absent" };
      throw error;
    }
  }

  protected linkTarget(file: string): string | undefined {
    try {
      const stat = fs.lstatSync(file, {
        bigint: true,
        throwIfNoEntry: false,
      });
      this.pathKinds.set(file, captureKind(stat));
      if (!stat) return undefined;
      if (stat.isDirectory()) this.durability?.observe(file, stat, false);
      if (stat.isSymbolicLink()) {
        this.durability?.target(file);
        try {
          return this.realPath(file);
        } catch (error) {
          if (!missingFile(error)) throw error;
          return lexicalLinkTarget(file);
        }
      }
    } catch (error) {
      if (!missingFile(error)) throw error;
      if (this.pathKinds.get(file) === undefined)
        this.pathKinds.set(file, "absent");
    }
    return undefined;
  }

  protected readDirectory(
    directory: string,
    limit: number,
    entryLimit = Infinity,
    known?: CaptureKind,
  ): PhysicalInput | undefined {
    const entries: PhysicalEntry[] = [];
    let bytes = Buffer.byteLength(
      JSON.stringify({ kind: "directory", entries }),
    );
    let handle;
    try {
      const kind = this.kind(directory, known);
      if (kind === "absent" && known === "absent") return { kind: "absent" };
      if (kind !== "absent" && kind !== "directory") return undefined;
      if (kind === "directory") handle = fs.opendirSync(directory);
    } catch (error) {
      if (!missingFile(error)) throw error;
    }
    if (!handle) {
      try {
        return fs.lstatSync(directory, { throwIfNoEntry: false })
          ? undefined
          : { kind: "absent" };
      } catch (error) {
        if (missingFile(error)) return { kind: "absent" };
        throw error;
      }
    }
    try {
      for (let entry = handle.readSync(); entry; entry = handle.readSync()) {
        if (entries.length >= entryLimit)
          throw new Error("directory membership changed");
        const value: PhysicalEntry = {
          name: entry.name,
          kind: entry.isSymbolicLink()
            ? "link"
            : entry.isFile()
              ? "file"
              : entry.isDirectory()
                ? "directory"
                : "other",
          target: entry.isSymbolicLink()
            ? this.realPath(path.join(directory, entry.name))
            : null,
        };
        bytes +=
          Buffer.byteLength(JSON.stringify(value)) + (entries.length ? 1 : 0);
        if (bytes > limit) throw new Error("directory evidence limit");
        entries.push(value);
      }
    } finally {
      handle.closeSync();
    }
    entries.sort((a, b) =>
      Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)),
    );
    return { kind: "directory", entries };
  }

  /** A check allocates at most its recorded directory bytes and bounded metadata. */
  current(evidence: ReuseEvidence): boolean {
    return evidence.complete && this.entriesCurrent(evidence);
  }

  markedCurrent(evidence: ReuseEvidence): boolean {
    return (
      evidence.uncaptured === "serveEdit" &&
      !evidence.complete &&
      !evidence.durable &&
      Object.values(evidence.inputs).every((value) =>
        ["file", "absent", "link"].includes(value.kind),
      ) &&
      this.entriesCurrent(evidence)
    );
  }

  private entriesCurrent(evidence: ReuseEvidence): boolean {
    try {
      return Object.entries(evidence.inputs).every(([file, expected]) => {
        switch (expected.kind) {
          case "filePath": {
            const actual = this.readFilePath(file);
            return actual.kind === "file" && actual.path === file;
          }
          case "absent":
            try {
              return (
                fs.lstatSync(file, { throwIfNoEntry: false }) === undefined
              );
            } catch (error) {
              return missingFile(error);
            }
          case "file": {
            if (this.realPath(file) !== file) return false;
            const actual = this.readMetadata(file).input;
            return actual.kind === "file" && actual.digest === expected.digest;
          }
          case "link":
            if (!fs.lstatSync(file).isSymbolicLink()) return false;
            try {
              return this.realPath(file) === expected.target;
            } catch (error) {
              if (!missingFile(error)) throw error;
              return (
                evidence.inputs[expected.target]?.kind === "absent" &&
                lexicalLinkTarget(file) === expected.target
              );
            }
          case "directory": {
            const actual = this.readDirectory(
              file,
              Buffer.byteLength(JSON.stringify(expected)),
              expected.entries.length,
            );
            return (
              actual?.kind === "directory" &&
              actual.entries.length === expected.entries.length &&
              actual.entries.every((entry, index) => {
                const saved = expected.entries[index]!;
                return (
                  entry.name === saved.name &&
                  entry.kind === saved.kind &&
                  entry.target === saved.target
                );
              }) &&
              this.realPath(file) === file
            );
          }
        }
      });
    } catch {
      return false;
    }
  }
}

/** Each check owns fresh bounded reads without capture caches. */
export function currentEvidence(evidence: ReuseEvidence): boolean {
  return new PhysicalInputReader().current(evidence);
}
