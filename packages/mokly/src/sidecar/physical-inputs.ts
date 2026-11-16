import path from "node:path";

import type { PhysicalInput } from "../generated/sidecar/PhysicalInput.js";
import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import { jsonObject, parseJson } from "./config-json.js";
import {
  EVIDENCE_LIMIT,
  PhysicalInputReader,
} from "./physical-input-reader.js";
import type { CapturedMetadata } from "./physical-input-reader.js";

/** First observations, metadata parsing, request retention, and every byte bound have one owner. */
export class PhysicalInputs extends PhysicalInputReader {
  readonly inputs = new Map<string, PhysicalInput>();
  readonly identityInputs = new Map<string, string>();
  private bytes = Buffer.byteLength(
    JSON.stringify({ complete: false, inputs: {} }),
  );
  private linkBytes = 0;
  private requestBytes = 0;
  private pending = Promise.resolve();
  private readonly requests = new Map<string, Promise<void>>();
  private readonly directories = new Map<string, Promise<void>>();
  private readonly files = new Map<
    string,
    Promise<CapturedMetadata | undefined>
  >();
  private readonly jsonFiles = new Map<string, Record<string, unknown>>();
  private readonly links = new Map<string, Promise<void>>();

  get usage() {
    return {
      evidenceBytes: this.bytes,
      metadataBytes: this.metadataBytes,
      visitedPathBytes: this.linkBytes,
      requestBytes: this.requestBytes,
    };
  }

  /** Duplicates share their own observation before they can join the capture queue. */
  request(
    name: string,
    directory: string,
    capture: () => Promise<void>,
  ): Promise<void> {
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
    const result = this.pending.then(async () => {
      if (!this.complete) return;
      try {
        await capture();
      } catch {
        this.complete = false;
      }
    });
    this.requests.set(key, result);
    this.pending = result;
    return result;
  }

  private save(file: string, value: PhysicalInput): void {
    if (!this.complete || this.inputs.has(file)) return;
    const bytes = Buffer.byteLength(JSON.stringify([file, value])) + 1;
    if (this.bytes + bytes > EVIDENCE_LIMIT) {
      this.complete = false;
      return;
    }
    this.bytes += bytes;
    this.inputs.set(file, value);
  }

  async file(
    file: string,
    identity = false,
  ): Promise<PhysicalInput | undefined> {
    const value = (await this.captureFile(file))?.input;
    if (identity && value?.kind === "file")
      this.identityInputs.set(file, value.digest);
    return value;
  }

  private captureFile(file: string): Promise<CapturedMetadata | undefined> {
    if (!this.complete) return Promise.resolve(undefined);
    let result = this.files.get(file);
    if (!result) {
      result = (async () => {
        await this.pathLinks(file);
        if (!this.complete) return undefined;
        const value = await this.readMetadata(file);
        this.save(
          value.input.kind === "absent" ? file : await this.realPath(file),
          value.input,
        );
        return value;
      })().catch(() => {
        this.complete = false;
        return undefined;
      });
      this.files.set(file, result);
    }
    return result;
  }

  async json(
    file: string,
    identity = false,
  ): Promise<Record<string, unknown> | undefined> {
    if ((await this.file(file, identity))?.kind !== "file") return undefined;
    const existing = this.jsonFiles.get(file);
    if (existing) return existing;
    const value = await this.captureFile(file);
    if (!value?.bytes) return undefined;
    try {
      const json = parseJson(value.bytes.toString("utf8"));
      if (!jsonObject(json)) throw new Error("configuration must be an object");
      this.jsonFiles.set(file, json);
      return json;
    } catch {
      this.complete = false;
      return undefined;
    }
  }

  directory(directory: string): Promise<void> {
    if (!this.complete) return Promise.resolve();
    let result = this.directories.get(directory);
    if (!result) {
      result = (async () => {
        await this.pathLinks(directory);
        if (!this.complete) return;
        const value = await this.readDirectory(
          directory,
          EVIDENCE_LIMIT - this.bytes,
        );
        if (value)
          this.save(
            value.kind === "absent"
              ? directory
              : await this.realPath(directory),
            value,
          );
      })().catch(() => {
        this.complete = false;
      });
      this.directories.set(directory, result);
    }
    return result;
  }

  async candidate(base: string): Promise<void> {
    await this.directory(path.dirname(base));
    await this.directory(base);
  }

  private pathLinks(file: string): Promise<void> {
    if (!this.complete) return Promise.resolve();
    let result = this.links.get(file);
    if (!result) {
      const bytes = Buffer.byteLength(file);
      if (this.linkBytes + bytes > EVIDENCE_LIMIT) {
        this.complete = false;
        return Promise.resolve();
      }
      this.linkBytes += bytes;
      result = (async () => {
        const parent = path.dirname(file);
        if (parent !== file) await this.pathLinks(parent);
        if (!this.complete) return;
        const target = await this.linkTarget(file);
        if (target !== undefined) this.save(file, { kind: "link", target });
      })();
      this.links.set(file, result);
    }
    return result;
  }

  async finish(): Promise<ReuseEvidence> {
    await this.pending;
    const value = {
      complete: this.complete,
      inputs: Object.fromEntries(
        [...this.inputs].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ),
    };
    value.complete = await currentEvidence(value);
    return value;
  }
}

/** Each check owns fresh bounded reads, independent of capture's retained bytes. */
export function currentEvidence(evidence: ReuseEvidence): Promise<boolean> {
  return new PhysicalInputs().current(evidence);
}
