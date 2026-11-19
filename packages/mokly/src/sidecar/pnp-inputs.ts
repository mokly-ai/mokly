import path from "node:path";

import type { Metafile } from "esbuild";

import { MetafileEdges } from "./metafile-edges.js";
import type { ModulePaths } from "./module-paths.js";
import { PackageFolders } from "./package-folders.js";
import type { FolderSelection } from "./package-folders.js";
import { PackageJson, parsePackageJson } from "./package-json.js";
import { packageMapTargets } from "./package-map.js";
import type { CapturedMetadata } from "./physical-input-reader.js";
import type { PhysicalInputs } from "./physical-inputs.js";
import { pnpFiles } from "./pnp-files.js";
import { pnpJson } from "./pnp-json.js";
import { resolutionRequest } from "./resolution-request.js";
import { bareSpecifier, packageName } from "./specifier.js";

function* pairs(value: unknown): Generator<[unknown, unknown]> {
  if (Array.isArray(value))
    for (const item of value)
      if (Array.isArray(item) && item.length === 2) yield [item[0], item[1]];
}

/** Index physical PnP candidates without copying locator, fallback, or ignore selection. */
export class PnpInputs {
  private readonly file: string | undefined;
  private snapshot: CapturedMetadata | undefined;
  private data: PackageJson | undefined;
  private readonly captured = new Set<string>();
  private readonly verified = new Set<string>();
  private discovery = false;
  private inspectNative = false;

  constructor(
    private readonly inputs: PhysicalInputs,
    private readonly configuration: string,
    private readonly paths: ModulePaths,
  ) {
    this.file = [...pnpFiles(configuration)].find(
      (candidate) => candidate.present,
    )?.file;
    this.inspectNative = this.file !== undefined;
    if (this.file)
      try {
        this.snapshot = this.inputs.inspectMetadata(this.file);
        if (this.snapshot?.bytes)
          this.data = pnpJson(this.file, this.snapshot.bytes.toString("utf8"));
      } catch {
        // The native selection pass below refuses uncovered folder maps only.
      }
  }

  capture(
    name: string,
    observe: (pkg: string, manifest: PackageJson) => void,
  ): void {
    if (!this.file || !this.data || !this.snapshot) return;
    const requested = "." + name.slice(packageName(name).length);
    for (const location of this.locations(packageName(name))) {
      const pkg = path.resolve(path.dirname(this.file), location);
      const file = path.join(pkg, "package.json");
      try {
        const snapshot = this.inputs.inspectMetadata(file);
        if (!snapshot?.bytes) continue;
        const manifest = parsePackageJson(snapshot.bytes.toString("utf8"));
        const folder = manifest
          .values("exports")
          .some((value) =>
            [...packageMapTargets(value, requested)].some(
              (target) => target.folder,
            ),
          );
        if (!folder) continue;
        if (
          !this.commit(this.file, this.snapshot) ||
          !this.commit(file, snapshot)
        ) {
          this.inputs.complete = false;
          return;
        }
        const canonical = this.inputs.canonicalFile(file);
        if (canonical) this.captured.add(canonical);
        observe(pkg, manifest);
      } catch {
        // Unsupported metadata is checked against the actual native selection.
      }
    }
  }

  private commit(file: string, pinned: CapturedMetadata): boolean {
    if (this.verified.has(file)) return true;
    const fresh = this.inputs.freshMetadata(file);
    if (!fresh || JSON.stringify(fresh.input) !== JSON.stringify(pinned.input))
      return false;
    this.inputs.file(file);
    this.verified.add(file);
    return this.inputs.complete;
  }

  covered(pkg: string): void {
    if (!this.discovery) {
      this.discovery = true;
      for (const { file } of pnpFiles(this.configuration))
        if (this.inputs.file(file)?.kind === "file") this.inspectNative = true;
    }
    const file = this.inputs.canonicalFile(path.join(pkg, "package.json"));
    if (file) this.captured.add(file);
  }

  private *locations(name: string): Generator<string> {
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
    yield* locations;
  }

  /** Unsupported native PnP forms fail closed only when they select an uncovered folder map. */
  finish(metafile: Metafile, aliases: Array<[string, string]>): void {
    if (!this.inspectNative || !this.inputs.complete) return;
    const folders = new PackageFolders(this.inputs, this.paths, false, true);
    const edges = new MetafileEdges(metafile, this.paths.sourceRoot);
    for (const [file, input] of Object.entries(metafile.inputs)) {
      if (!path.isAbsolute(file) || edges.own(file)) continue;
      for (const edge of input.imports) {
        if (edge.external || edge.original === undefined) continue;
        const selection = edges.selection(edge.path);
        if (selection.kind !== "physical") continue;
        const request = resolutionRequest(
          edge.original,
          path.dirname(file),
          aliases,
          this.configuration,
        );
        if (
          request.kind !== "lookup" ||
          !bareSpecifier(request.name) ||
          request.name.startsWith("#")
        )
          continue;
        let found: FolderSelection | undefined;
        try {
          found = folders.lookup(
            request.name,
            request.directory,
            selection.file,
          );
        } catch {
          this.inputs.complete = false;
          return;
        }
        if (
          !this.inputs.complete ||
          (found?.candidates.length &&
            !found.manifests.some((file) => this.captured.has(file)))
        ) {
          this.inputs.complete = false;
          return;
        }
      }
    }
  }
}
