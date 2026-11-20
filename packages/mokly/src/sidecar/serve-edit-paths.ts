import fs from "node:fs";
import path from "node:path";

import { ConfigInputs } from "./config-inputs.js";
import type { PathSettings } from "./config-inputs.js";
import { mappedCandidates } from "./mapped-paths.js";
import { mappedSelection } from "./mapped-selection.js";
import type { SelectedImport } from "./metafile-edges.js";
import type { ModulePaths } from "./module-paths.js";
import { EVIDENCE_LIMIT } from "./physical-input-reader.js";
import { PhysicalInputs } from "./physical-inputs.js";
import type { LookupRequest } from "./resolution-request.js";

/** Add readable mapped lookups to the existing live directory and metadata checks. */
export class ServeEditPaths {
  private readonly scopes = new Map<string, PathSettings | null>();
  private reader:
    { physical: PhysicalInputs; configs: ConfigInputs } | undefined;

  private readonly directories = new Set<string>();
  private readonly files = new Set<string>();
  private stagedBytes = 0;

  constructor(private readonly paths: ModulePaths) {}

  cachedScope(directory: string): PathSettings | undefined {
    return this.scopes.get(directory) ?? undefined;
  }

  private stage(set: Set<string>, file: string): boolean {
    if (set.has(file)) return true;
    if (!this.directories.has(file) && !this.files.has(file)) {
      const bytes = 2 * Buffer.byteLength(JSON.stringify(file)) + 128;
      if (bytes > EVIDENCE_LIMIT - this.stagedBytes) return false;
      this.stagedBytes += bytes;
    }
    set.add(file);
    return true;
  }

  accept(request: LookupRequest, selection: SelectedImport): boolean {
    try {
      const config = this.scope(request.directory, this.paths);
      if (!config) return true;
      let configured = false;
      let selected = false;
      let contained = false;
      for (const base of mappedCandidates(config, request.name)) {
        configured = true;
        if (selection.kind === "unknown") return false;
        const kind = mappedSelection(
          base,
          selection.file,
          this.paths.settings.resolveExtensions,
        );
        if (kind === "file") {
          selected = true;
          break;
        }
        if (!this.stage(this.directories, path.dirname(base))) return false;
        if (kind === "directory") {
          selected = true;
          break;
        }
        if (kind === "contained") contained = true;
        if (
          !this.stage(this.directories, base) ||
          !this.stage(this.files, path.join(base, "package.json"))
        )
          return false;
      }
      if (
        configured &&
        !selected &&
        !contained &&
        (selection.kind === "unknown" ||
          (!selection.file.split(path.sep).includes("node_modules") &&
            !this.paths.dependencyDirectory(selection.file)))
      )
        return false;
      return true;
    } catch {
      return false;
    }
  }

  finish(): boolean {
    try {
      for (const directory of this.directories) this.paths.name(directory);
      for (const file of this.files) {
        this.paths.name(file);
        const stat = fs.statSync(file, { throwIfNoEntry: false });
        if (stat && !stat.isFile()) return false;
      }
    } catch {
      return false;
    }
    for (const directory of this.directories)
      this.paths.lookupDirectories.add(directory);
    for (const file of this.files) this.paths.lookupFiles.add(file);
    return true;
  }

  private scope(directory: string, paths: ModulePaths): PathSettings | null {
    const existing = this.scopes.get(directory);
    if (existing !== undefined) return existing;
    if (!this.reader) {
      const physical = new PhysicalInputs();
      this.reader = { physical, configs: new ConfigInputs(physical, paths) };
    }
    const config = this.reader.configs.scope(directory);
    const value = this.reader.physical.complete ? config : null;
    if (value === null) this.reader = undefined;
    this.scopes.set(directory, value);
    return value;
  }
}
