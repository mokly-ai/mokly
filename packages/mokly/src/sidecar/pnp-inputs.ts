import path from "node:path";

import type { Metafile } from "esbuild";

import type { ConfigInputs } from "./config-inputs.js";
import { MetafileEdges } from "./metafile-edges.js";
import type { ModulePaths } from "./module-paths.js";
import { PackageFolders } from "./package-folders.js";
import type { FolderSelection } from "./package-folders.js";
import { parsePackageJson } from "./package-json.js";
import type { PackageJson } from "./package-json.js";
import { packageMapTargets } from "./package-map.js";
import type { CapturedMetadata } from "./physical-input-reader.js";
import type { PhysicalInputs } from "./physical-inputs.js";
import { pnpFiles } from "./pnp-files.js";
import { PnpLocations } from "./pnp-locations.js";
import { resolutionRequest } from "./resolution-request.js";
import { bareSpecifier, packageName } from "./specifier.js";

/** Index physical PnP candidates without copying locator, fallback, or ignore selection. */
export class PnpInputs {
  readonly locations: PnpLocations;
  private readonly captured = new Set<string>();
  private readonly verified = new Set<string>();
  private discovery = false;
  private inspectNative = false;

  constructor(
    private readonly inputs: PhysicalInputs,
    private readonly configuration: string,
    private readonly paths: ModulePaths,
    private readonly configs: ConfigInputs,
  ) {
    this.locations = new PnpLocations(this.inputs, this.configuration);
    this.locations.read();
    this.inspectNative = this.locations.file !== undefined;
  }

  capture(
    name: string,
    observe: (pkg: string, manifest: PackageJson) => void,
  ): void {
    const { file: state, snapshot: pinned } = this.locations;
    if (!state || !pinned) return;
    const requested = "." + name.slice(packageName(name).length);
    for (const pkg of this.locations.roots(packageName(name))) {
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
        if (!this.commit(state, pinned) || !this.commit(file, snapshot)) {
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

  /** Check qualified native package selections against the captured folder evidence. */
  finish(metafile: Metafile, aliases: Array<[string, string]>): void {
    if (!this.inspectNative || !this.inputs.complete) return;
    const folders = new PackageFolders(
      this.inputs,
      this.paths,
      this.locations,
      this.configs,
      false,
      true,
    );
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
