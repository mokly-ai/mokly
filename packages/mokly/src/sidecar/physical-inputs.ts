import path from "node:path";

import type { PhysicalInput } from "../generated/sidecar/PhysicalInput.js";
import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import { MetadataInputs } from "./metadata-inputs.js";
import type { PackageJson } from "./package-json.js";
import {
  EVIDENCE_LIMIT,
  PhysicalInputReader,
} from "./physical-input-reader.js";
import type {
  CapturedMetadata,
  FilePathProbe,
} from "./physical-input-reader.js";

/** Filesystem observations, metadata parsing, request retention, and every byte bound have one owner. */
export class PhysicalInputs extends PhysicalInputReader {
  readonly inputs = new Map<string, PhysicalInput>();
  readonly identityInputs = new Map<string, string>();
  private bytes = Buffer.byteLength(
    JSON.stringify({ complete: false, durable: false, inputs: {} }),
  );
  private linkBytes = 0;
  private requestBytes = 0;
  private pending = Promise.resolve();
  private readonly requests = new Map<string, Promise<void>>();
  private readonly directories = new Set<string>();
  private readonly files = new Map<string, CapturedMetadata>();
  private readonly observedFiles = new Set<string>();
  private readonly inspectedPaths = new Set<string>();
  private inspectionBytes = 0;
  private readonly metadata = new MetadataInputs(this);

  get usage() {
    return {
      evidenceBytes: this.bytes,
      metadataBytes: this.metadataBytes,
      visitedPathBytes:
        this.linkBytes + this.inspectionBytes + (this.durability?.bytes ?? 0),
      requestBytes: this.requestBytes,
    };
  }

  /** Duplicates share their own observation before they can join the capture queue. */
  request(name: string, directory: string, capture: () => void): Promise<void> {
    if (!this.complete) return Promise.resolve();
    if (
      Buffer.byteLength(name) + Buffer.byteLength(directory) >
      EVIDENCE_LIMIT
    ) {
      this.complete = false;
      return Promise.resolve();
    }
    const key = JSON.stringify([name, directory]);
    const existing = this.requests.get(key);
    if (existing) return existing;
    const bytes = Buffer.byteLength(key);
    if (this.requestBytes + bytes > EVIDENCE_LIMIT) {
      this.complete = false;
      return Promise.resolve();
    }
    this.requestBytes += bytes;
    const result = this.pending.then(() => {
      if (!this.complete) return;
      try {
        capture();
      } catch {
        this.complete = false;
      }
    });
    this.requests.set(key, result);
    this.pending = result;
    return result;
  }

  private save(file: string, value: PhysicalInput): void {
    const previous = this.inputs.get(file);
    if (
      !this.complete ||
      (previous && !(previous.kind === "filePath" && value.kind === "file"))
    )
      return;
    const bytes =
      Buffer.byteLength(JSON.stringify([file, value])) +
      1 -
      (previous ? Buffer.byteLength(JSON.stringify([file, previous])) + 1 : 0);
    if (this.bytes + bytes > EVIDENCE_LIMIT) {
      this.complete = false;
      return;
    }
    this.bytes += bytes;
    this.inputs.set(file, value);
  }

  /** Exact resolution needs the canonical file path; source owners check its content. */
  exactFile(file: string): boolean {
    return this.canonicalFile(file) !== undefined && this.complete;
  }

  /** Configuration settings anchor at the canonical file while retaining written links. */
  canonicalFile(file: string): string | undefined {
    const value = this.capturePath(file);
    return value?.kind === "file" ? value.path : undefined;
  }

  canonicalDirectory(directory: string, observe = true): string | undefined {
    if (!this.complete) return undefined;
    try {
      if (observe) this.pathLinks(directory);
      else this.inspectPath(directory);
      return this.complete
        ? this.readDirectoryPath(
            directory,
            observe ? this.pathKinds.get(directory) : undefined,
          )
        : undefined;
    } catch {
      this.complete = false;
      return undefined;
    }
  }

  /** Optional selection observes absence and regular-file paths without reading bodies. */
  optionalFile(file: string): boolean | undefined {
    const value = this.capturePath(file);
    if (!value || !this.complete) return undefined;
    if (value.kind === "other") {
      this.complete = false;
      return undefined;
    }
    return value.kind === "file";
  }

  private capturePath(file: string): FilePathProbe | undefined {
    if (!this.complete) return undefined;
    try {
      this.pathLinks(file);
      if (!this.complete) return undefined;
      const value = this.readFilePath(file, this.pathKinds.get(file));
      if (value.kind === "file") this.save(value.path, { kind: "filePath" });
      if (value.kind === "absent") this.save(file, value);
      return value;
    } catch {
      this.complete = false;
      return undefined;
    }
  }

  file(file: string, identity = false): PhysicalInput | undefined {
    const value = this.captureFile(file)?.input;
    if (identity && value?.kind === "file")
      this.identityInputs.set(file, value.digest);
    return value;
  }

  private captureFile(file: string): CapturedMetadata | undefined {
    if (!this.complete) return undefined;
    const existing = this.files.get(file);
    if (existing && this.observedFiles.has(file)) return existing;
    try {
      this.pathLinks(file);
      if (!this.complete) return undefined;
      const value = this.inspectMetadata(file);
      if (!value) return undefined;
      this.save(
        value.input.kind === "absent" ? file : this.realPath(file),
        value.input,
      );
      this.observedFiles.add(file);
      return value;
    } catch {
      this.complete = false;
      return undefined;
    }
  }

  json(file: string, identity = false): Record<string, unknown> | undefined {
    return this.metadata.json(file, identity);
  }

  packageJson(
    file: string,
    observe = true,
    current = false,
    allowNonObject = false,
  ): PackageJson | undefined {
    return this.metadata.package(file, observe, current, allowNonObject);
  }

  /** Pin metadata without publishing an observation for an unrelated resolution. */
  inspectMetadata(file: string): CapturedMetadata | undefined {
    const existing = this.files.get(file);
    if (existing) return existing;
    const value = this.freshMetadata(file);
    if (value) this.files.set(file, value);
    return value;
  }

  /** Fresh verification and classification reads use the same aggregate metadata allowance. */
  freshMetadata(file: string): CapturedMetadata | undefined {
    if (!this.complete) return undefined;
    try {
      this.inspectPath(file);
      return this.readMetadata(file, this.pathKinds.get(file));
    } catch {
      this.complete = false;
      return undefined;
    }
  }

  private inspectPath(file: string): void {
    if (this.pathKinds.has(file) || this.inspectedPaths.has(file)) return;
    const bytes = Buffer.byteLength(file);
    if (this.linkBytes + this.inspectionBytes + bytes > EVIDENCE_LIMIT)
      throw new Error("metadata path evidence limit");
    this.inspectionBytes += bytes;
    this.inspectedPaths.add(file);
    this.durability?.budget(this.linkBytes + this.inspectionBytes);
  }

  directory(directory: string): void {
    if (!this.complete || this.directories.has(directory)) return;
    this.directories.add(directory);
    try {
      this.pathLinks(directory);
      if (!this.complete) return;
      const value = this.readDirectory(
        directory,
        EVIDENCE_LIMIT - this.bytes,
        Infinity,
        this.pathKinds.get(directory),
      );
      if (value)
        this.save(
          value.kind === "absent" ? directory : this.realPath(directory),
          value,
        );
    } catch {
      this.complete = false;
    }
  }

  candidate(base: string): void {
    this.directory(path.dirname(base));
    this.directory(base);
  }

  private pathLinks(file: string): void {
    if (this.inspectedPaths.delete(file))
      this.inspectionBytes -= Buffer.byteLength(file);
    if (!this.complete || this.pathKinds.has(file)) return;
    const bytes = Buffer.byteLength(file);
    if (this.linkBytes + this.inspectionBytes + bytes > EVIDENCE_LIMIT) {
      this.complete = false;
      return;
    }
    this.linkBytes += bytes;
    this.durability?.budget(this.linkBytes + this.inspectionBytes);
    this.pathKinds.set(file, undefined);
    const parent = path.dirname(file);
    if (parent !== file) this.pathLinks(parent);
    if (!this.complete) return;
    const kind = this.pathKinds.get(parent);
    if (parent !== file && kind && kind !== "directory" && kind !== "link") {
      this.pathKinds.set(file, "absent");
      return;
    }
    const target = this.linkTarget(file);
    if (target !== undefined) this.save(file, { kind: "link", target });
  }

  async finish(): Promise<ReuseEvidence> {
    await this.pending;
    const value = {
      complete: this.complete,
      durable: false,
      inputs: Object.fromEntries(
        [...this.inputs].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ),
    };
    value.complete = currentEvidence(value);
    value.durable = this.durability?.finish() ?? false;
    return value;
  }
}

/** Each check owns fresh bounded reads, independent of capture's retained bytes. */
export function currentEvidence(evidence: ReuseEvidence): boolean {
  return new PhysicalInputs().current(evidence);
}
