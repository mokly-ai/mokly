import path from "node:path";

import { PackageJson } from "./package-json.js";
import type { CapturedMetadata } from "./physical-input-reader.js";
import type { PhysicalInputs } from "./physical-inputs.js";
import { pnpFiles } from "./pnp-files.js";
import { pnpJson } from "./pnp-json.js";

function* pairs(value: unknown): Generator<[unknown, unknown]> {
  if (Array.isArray(value))
    for (const item of value)
      if (Array.isArray(item) && item.length === 2) yield [item[0], item[1]];
}

/** Pinned physical location candidates, without locator, fallback, or ignore selection. */
export class PnpLocations {
  file: string | undefined;
  snapshot: CapturedMetadata | undefined;
  private data: PackageJson | undefined;
  private loaded = false;

  constructor(
    private readonly inputs: PhysicalInputs,
    private readonly configuration: string,
  ) {}

  read(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.file = [...pnpFiles(this.configuration)].find(
      (candidate) => candidate.present,
    )?.file;
    if (this.file)
      try {
        this.snapshot = this.inputs.inspectMetadata(this.file);
        if (this.snapshot?.bytes)
          this.data = pnpJson(this.file, this.snapshot.bytes.toString("utf8"));
      } catch {
        // A native selection still needs a qualified root after an unsupported state.
      }
  }

  *roots(name: string): Generator<string> {
    this.read();
    if (!this.file) return;
    const packages: Array<[unknown, PackageJson]> = [];
    const names = new Set([name]);
    const alias = (key: unknown, target: unknown) => {
      if (
        key === name &&
        Array.isArray(target) &&
        typeof target[0] === "string"
      )
        names.add(target[0]);
    };
    for (const registry of this.data?.values("packageRegistryData") ?? [])
      for (const [ident, references] of pairs(registry))
        for (const [, value] of pairs(references))
          if (value instanceof PackageJson) {
            packages.push([ident, value]);
            for (const dependencies of value.values("packageDependencies"))
              for (const [key, target] of pairs(dependencies))
                alias(key, target);
          }
    for (const pool of this.data?.values("fallbackPool") ?? [])
      for (const [key, target] of pairs(pool)) alias(key, target);
    const locations = new Set<string>();
    for (const [ident, value] of packages)
      if (typeof ident === "string" && names.has(ident))
        for (const location of value.values("packageLocation"))
          if (typeof location === "string") locations.add(location);
    for (const location of locations)
      yield path.resolve(path.dirname(this.file), location);
  }
}
