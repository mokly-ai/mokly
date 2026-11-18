import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { PhysicalEntry } from "../generated/sidecar/PhysicalEntry.js";
import type { PhysicalInput } from "../generated/sidecar/PhysicalInput.js";
import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import type { CaptureDurability } from "./capture-durability.js";
import { everyInput, missingFile } from "./file-digests.js";

export const EVIDENCE_LIMIT = 8 * 1024 * 1024;
const METADATA_FILE_LIMIT = 1024 * 1024;

export interface CapturedMetadata {
  input: PhysicalInput;
  bytes?: Buffer;
}

export type FilePathProbe =
  { kind: "file"; path: string } | { kind: "absent" } | { kind: "other" };

/** Protected filesystem primitives of the one PhysicalInputs owner. */
export abstract class PhysicalInputReader {
  complete = true;
  protected metadataBytes = 0;

  constructor(protected readonly durability?: CaptureDurability) {}

  protected async readMetadata(file: string): Promise<CapturedMetadata> {
    let handle;
    try {
      handle = await fs.open(file, "r");
    } catch (error) {
      if (missingFile(error)) return { input: { kind: "absent" } };
      throw error;
    }
    try {
      const metadata = await handle.stat({ bigint: true });
      if (
        !metadata.isFile() ||
        metadata.size > BigInt(METADATA_FILE_LIMIT) ||
        BigInt(this.metadataBytes) + metadata.size > BigInt(EVIDENCE_LIMIT)
      )
        throw new Error("metadata evidence limit");
      await this.durability?.observe(file, metadata, true, true);
      const size = Number(metadata.size);
      this.metadataBytes += size;
      const bytes = Buffer.alloc(size);
      let length = 0;
      while (length < bytes.length) {
        const read = await handle.read(bytes, length, bytes.length - length);
        if (!read.bytesRead) break;
        length += read.bytesRead;
      }
      if (
        length !== bytes.length ||
        (await handle.stat({ bigint: true })).size !== BigInt(bytes.length)
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
      await handle.close();
    }
  }

  protected async realPath(file: string): Promise<string> {
    await this.durability?.path(file);
    return fs.realpath(file);
  }

  protected async readFilePath(file: string): Promise<FilePathProbe> {
    try {
      return (await fs.stat(file)).isFile()
        ? { kind: "file", path: await this.realPath(file) }
        : { kind: "other" };
    } catch (error) {
      if (missingFile(error)) return { kind: "absent" };
      throw error;
    }
  }

  protected async linkTarget(file: string): Promise<string | undefined> {
    try {
      const stat = await fs.lstat(file, { bigint: true });
      if (stat.isDirectory()) await this.durability?.observe(file, stat, false);
      if (stat.isSymbolicLink()) {
        await this.durability?.target(file);
        return await this.realPath(file);
      }
    } catch (error) {
      if (!missingFile(error)) throw error;
    }
    return undefined;
  }

  protected async readDirectory(
    directory: string,
    limit: number,
    entryLimit = Infinity,
  ): Promise<PhysicalInput | undefined> {
    const entries: PhysicalEntry[] = [];
    let bytes = Buffer.byteLength(
      JSON.stringify({ kind: "directory", entries }),
    );
    let handle;
    try {
      handle = await fs.opendir(directory);
    } catch (error) {
      if (!missingFile(error)) throw error;
      try {
        await fs.lstat(directory);
        return undefined;
      } catch (error) {
        if (missingFile(error)) return { kind: "absent" };
        throw error;
      }
    }
    for await (const entry of handle) {
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
          ? await this.realPath(path.join(directory, entry.name))
          : null,
      };
      bytes +=
        Buffer.byteLength(JSON.stringify(value)) + (entries.length ? 1 : 0);
      if (bytes > limit) throw new Error("directory evidence limit");
      entries.push(value);
    }
    entries.sort((a, b) =>
      Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)),
    );
    return { kind: "directory", entries };
  }

  /** A check allocates at most its recorded directory bytes and bounded metadata. */
  async current(evidence: ReuseEvidence): Promise<boolean> {
    if (!evidence.complete) return false;
    return everyInput(
      Object.entries(evidence.inputs),
      async ([file, expected]) => {
        switch (expected.kind) {
          case "filePath": {
            const actual = await this.readFilePath(file);
            return actual.kind === "file" && actual.path === file;
          }
          case "absent":
            try {
              await fs.lstat(file);
              return false;
            } catch (error) {
              return missingFile(error);
            }
          case "file": {
            if ((await this.realPath(file)) !== file) return false;
            const actual = (await this.readMetadata(file)).input;
            return actual.kind === "file" && actual.digest === expected.digest;
          }
          case "link":
            return (
              (await fs.lstat(file)).isSymbolicLink() &&
              (await this.realPath(file)) === expected.target
            );
          case "directory": {
            const actual = await this.readDirectory(
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
              (await this.realPath(file)) === file
            );
          }
        }
      },
    );
  }
}
