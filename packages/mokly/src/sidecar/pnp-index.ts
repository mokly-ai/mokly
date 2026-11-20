import path from "node:path";

import { PackageJson } from "./package-json.js";

function* pairs(value: unknown): Generator<[unknown, unknown]> {
  if (Array.isArray(value))
    for (const item of value)
      if (Array.isArray(item) && item.length === 2) yield [item[0], item[1]];
}

type Dependencies = Map<string, Set<string>>;

interface PackageReference {
  locator: string;
  locations: Set<string>;
}

/** Index all repeated registry values once, without native owner exclusions. */
export class PnpIndex {
  private readonly packages = new Map<string, PackageReference[]>();
  private readonly aliases = new Map<string, Set<string>>();
  private readonly issuers = new Map<string, Dependencies[]>();
  private readonly top = new Map<string, Set<string>>();
  private readonly fallback = new Map<string, Set<string>>();

  constructor(data: PackageJson, directory: string) {
    for (const registry of data.values("packageRegistryData"))
      for (const [ident, references] of pairs(registry))
        for (const [reference, value] of pairs(references)) {
          if (!(value instanceof PackageJson)) continue;
          const locations = new Set(
            value
              .values("packageLocation")
              .flatMap((location) =>
                typeof location === "string"
                  ? [path.resolve(directory, location)]
                  : [],
              ),
          );
          if (typeof ident === "string") {
            const entries = this.packages.get(ident) ?? [];
            entries.push({
              locator: JSON.stringify([ident, reference]),
              locations,
            });
            this.packages.set(ident, entries);
          }
          const dependencies = new Map<string, Set<string>>();
          for (const field of value.values("packageDependencies")) {
            if (ident === null) this.dependencies(this.top, field);
            this.dependencies(dependencies, field);
          }
          for (const location of locations) {
            const indexed = this.issuers.get(location) ?? [];
            indexed.push(dependencies);
            this.issuers.set(location, indexed);
          }
        }
    for (const pool of data.values("fallbackPool"))
      this.dependencies(this.fallback, pool);
  }

  private dependencies(index: Dependencies, value: unknown): void {
    for (const [name, target] of pairs(value)) {
      if (typeof name !== "string") continue;
      const ident = Array.isArray(target) ? target[0] : name;
      const reference = Array.isArray(target) ? target[1] : target;
      if (typeof ident !== "string" || typeof reference !== "string") continue;
      let references = index.get(name);
      if (!references) index.set(name, (references = new Set()));
      references.add(JSON.stringify([ident, reference]));
      if (ident !== name) {
        let aliases = this.aliases.get(name);
        if (!aliases) this.aliases.set(name, (aliases = new Set()));
        aliases.add(ident);
      }
    }
  }

  *roots(name: string, directory: string | undefined) {
    let reachable: Set<string> | undefined;
    if (directory !== undefined) {
      reachable = new Set([
        ...(this.top.get(name) ?? []),
        ...(this.fallback.get(name) ?? []),
      ]);
      for (;;) {
        for (const dependencies of this.issuers.get(directory) ?? [])
          for (const target of dependencies.get(name) ?? [])
            reachable.add(target);
        const parent = path.dirname(directory);
        if (parent === directory) break;
        directory = parent;
      }
    }
    const locations = new Map<string, boolean>();
    for (const ident of new Set([name, ...(this.aliases.get(name) ?? [])]))
      for (const entry of this.packages.get(ident) ?? [])
        for (const location of entry.locations)
          locations.set(
            location,
            (locations.get(location) ?? false) ||
              reachable === undefined ||
              reachable.has(entry.locator),
          );
    for (const [directory, reachable] of locations)
      yield { directory, reachable };
  }
}
