import { jsonObject, parseJson } from "./config-json.js";
import { PackageJson, parsePackageJson } from "./package-json.js";
import type { PhysicalInputs } from "./physical-inputs.js";

/** Parsed metadata borrows the physical owner's snapshots and its one read budget. */
export class MetadataInputs {
  private readonly configurations = new Map<string, Record<string, unknown>>();
  private readonly packages = new Map<string, PackageJson>();
  private readonly currentPackages = new Map<string, PackageJson>();

  constructor(private readonly inputs: PhysicalInputs) {}

  json(file: string, identity: boolean): Record<string, unknown> | undefined {
    if (this.inputs.file(file, identity)?.kind !== "file") return undefined;
    const existing = this.configurations.get(file);
    if (existing) return existing;
    const value = this.inputs.inspectMetadata(file);
    if (!value?.bytes) return undefined;
    try {
      const json = parseJson(value.bytes.toString("utf8"));
      if (!jsonObject(json)) throw new Error("configuration must be an object");
      this.configurations.set(file, json);
      return json;
    } catch {
      this.inputs.complete = false;
      return undefined;
    }
  }

  package(
    file: string,
    observe: boolean,
    current: boolean,
    allowNonObject: boolean,
  ): PackageJson | undefined {
    if (!this.inputs.complete) return undefined;
    const cache = current ? this.currentPackages : this.packages;
    const key = JSON.stringify([file, allowNonObject]);
    if (observe && this.inputs.file(file)?.kind !== "file") return undefined;
    const existing = cache.get(key);
    if (existing) return existing;
    const value = current
      ? this.inputs.freshMetadata(file)
      : this.inputs.inspectMetadata(file);
    if (!value?.bytes) return undefined;
    try {
      const manifest = parsePackageJson(
        value.bytes.toString("utf8"),
        [],
        allowNonObject,
      );
      cache.set(key, manifest);
      return manifest;
    } catch (error) {
      if (allowNonObject && error instanceof SyntaxError) {
        const manifest = new PackageJson([]);
        cache.set(key, manifest);
        return manifest;
      }
      this.inputs.complete = false;
      return undefined;
    }
  }
}
