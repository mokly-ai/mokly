import path from "node:path";

import type { PhysicalInput } from "../generated/sidecar/PhysicalInput.js";
import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import { MetadataInputs } from "./metadata-inputs.js";
import type { PackageJson } from "./package-json.js";
import { EVIDENCE_LIMIT, currentEvidence } from "./physical-input-reader.js";
import type { CapturedMetadata } from "./physical-input-reader.js";
import { PhysicalPathInputs } from "./physical-path-inputs.js";

/** Filesystem observations, metadata parsing, request retention, and every byte bound have one owner. */
export class PhysicalInputs extends PhysicalPathInputs {
  readonly inputs = new Map<string, PhysicalInput>();
  readonly identityInputs = new Map<string, string | null>();
  private bytes = Buffer.byteLength(
    JSON.stringify({ complete: false, durable: false, inputs: {} }),
  );
  private requestBytes = 0;
  private pending = Promise.resolve();
  private readonly requests = new Map<string, Promise<void>>();
  private readonly directories = new Set<string>();
  private readonly files = new Map<string, CapturedMetadata>();
  private readonly observedFiles = new Set<string>();
  private readonly metadata = new MetadataInputs(this);

  get usage() {
    return {
      evidenceBytes: this.bytes,
      metadataBytes: this.metadataBytes,
      visitedPathBytes: this.visitedPathBytes,
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

  protected override save(file: string, value: PhysicalInput): void {
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

  file(file: string, identity = false): PhysicalInput | undefined {
    const value = this.captureFile(file)?.input;
    if (identity && (value?.kind === "file" || value?.kind === "absent"))
      this.identityInputs.set(
        file,
        value.kind === "file" ? value.digest : null,
      );
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
      if (value.bytes) this.observer?.metadata(file, value.bytes);
      return value;
    } catch {
      this.complete = false;
      return undefined;
    }
  }

  json(file: string, identity = false): Record<string, unknown> | undefined {
    return this.metadata.json(file, identity);
  }

  packageKnown(file: string, current = false, allowNonObject = false): boolean {
    return this.metadata.known(file, current, allowNonObject);
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
      if (value) {
        const canonical =
          value.kind === "absent" ? directory : this.realPath(directory);
        this.save(canonical, value);
        if (value.kind === "directory")
          this.observer?.directory(directory, canonical);
      }
    } catch {
      this.complete = false;
    }
  }

  candidate(base: string): void {
    this.directory(path.dirname(base));
    this.directory(base);
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
