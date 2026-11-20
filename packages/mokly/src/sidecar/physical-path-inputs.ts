import path from "node:path";

import type { PhysicalInput } from "../generated/sidecar/PhysicalInput.js";

import {
  EVIDENCE_LIMIT,
  PhysicalInputReader,
} from "./physical-input-reader.js";
import type { FilePathProbe } from "./physical-input-reader.js";

/** Path facts and observations share the capture owner's visited-path allowance. */
export abstract class PhysicalPathInputs extends PhysicalInputReader {
  private linkBytes = 0;
  private inspectionBytes = 0;
  private readonly inspectedPaths = new Map<string, boolean>();

  protected abstract save(file: string, value: PhysicalInput): void;

  protected get visitedPathBytes(): number {
    return (
      this.linkBytes + this.inspectionBytes + (this.durability?.bytes ?? 0)
    );
  }

  notDirectory(directory: string): boolean {
    return this.inspectedPaths.get(directory) === true;
  }

  /** Retain written links without reading the target as metadata. */
  retainLinks(file: string): void {
    try {
      this.pathLinks(file);
    } catch {
      this.complete = false;
    }
  }

  /** Exact resolution needs the canonical file path; source owners check its content. */
  exactFile(file: string): boolean {
    return this.canonicalFile(file) !== undefined && this.complete;
  }

  /** Configuration settings anchor at the canonical file while retaining written links. */
  canonicalFile(file: string, observe = true): string | undefined {
    if (!this.complete) return undefined;
    if (!observe) {
      try {
        this.inspectPath(file);
        const value = this.readFilePath(file);
        return value.kind === "file" ? value.path : undefined;
      } catch {
        this.complete = false;
        return undefined;
      }
    }
    const value = this.capturePath(file);
    return value?.kind === "file" ? value.path : undefined;
  }

  canonicalDirectory(directory: string, observe = true): string | undefined {
    if (!this.complete) return undefined;
    try {
      if (observe) this.pathLinks(directory);
      else this.inspectPath(directory);
      const canonical = this.complete
        ? this.readDirectoryPath(
            directory,
            observe ? this.pathKinds.get(directory) : undefined,
          )
        : undefined;
      if (this.complete && !observe && this.inspectedPaths.has(directory))
        this.inspectedPaths.set(directory, canonical === undefined);
      return canonical;
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

  protected inspectPath(file: string): void {
    if (this.pathKinds.has(file) || this.inspectedPaths.has(file)) return;
    const bytes = Buffer.byteLength(file);
    if (this.linkBytes + this.inspectionBytes + bytes > EVIDENCE_LIMIT)
      throw new Error("metadata path evidence limit");
    this.inspectionBytes += bytes;
    this.inspectedPaths.set(file, false);
    this.durability?.budget(this.linkBytes + this.inspectionBytes);
  }

  protected pathLinks(file: string): void {
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
}
