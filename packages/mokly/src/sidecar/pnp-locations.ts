import path from "node:path";

import type { ModulePaths } from "./module-paths.js";
import { importerDirectory } from "./package-directory.js";
import type { CapturedMetadata } from "./physical-input-reader.js";
import type { PhysicalInputs } from "./physical-inputs.js";
import { pnpFiles } from "./pnp-files.js";
import { PnpIndex } from "./pnp-index.js";
import { pnpJson } from "./pnp-json.js";

/** Pin registry roots and their shared reachable-reference superset. */
export class PnpLocations {
  file: string | undefined;
  snapshot: CapturedMetadata | undefined;
  private index: PnpIndex | undefined;
  private loaded = false;

  constructor(
    private readonly inputs: PhysicalInputs,
    private readonly configuration: string,
    private readonly paths: ModulePaths,
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
        if (this.snapshot?.bytes) {
          const data = pnpJson(this.file, this.snapshot.bytes.toString("utf8"));
          if (data) this.index = new PnpIndex(data, path.dirname(this.file));
        }
      } catch {
        // A native selection still needs a qualified root after an unsupported state.
      }
  }

  *roots(name: string, directory: string) {
    this.read();
    // The second native start is a package scope. Keep all roots if it can differ.
    const start =
      importerDirectory(this.paths, name, directory) === directory
        ? directory
        : undefined;
    if (this.index) yield* this.index.roots(name, start);
  }
}
