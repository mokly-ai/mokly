import fs from "node:fs";
import path from "node:path";

import type { Metafile } from "esbuild";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { ConfigInputs } from "./config-inputs.js";
import type { PathSettings } from "./config-inputs.js";
import { mappedPaths } from "./mapped-paths.js";
import { mappedSelection } from "./mapped-selection.js";
import { MetafileEdges } from "./metafile-edges.js";
import type { ModulePaths } from "./module-paths.js";
import { EVIDENCE_LIMIT } from "./physical-input-reader.js";
import { PhysicalInputs } from "./physical-inputs.js";
import { resolutionRequest } from "./resolution-request.js";
import { bareSpecifier } from "./specifier.js";

function* candidates(config: PathSettings, name: string): Generator<string> {
  let mapped = false;
  for (const candidate of mappedPaths(config, name, "selected")) {
    mapped = true;
    yield candidate;
  }
  if (path.isAbsolute(name)) {
    if (mapped) yield name;
  } else if (config.baseUrl) yield path.resolve(config.baseUrl, name);
}

/** Add readable mapped lookups to the existing live directory and metadata checks. */
export class ServeEditPaths {
  private readonly scopes = new Map<string, PathSettings | null>();
  private reader:
    { physical: PhysicalInputs; configs: ConfigInputs } | undefined;

  constructor(private readonly params: BundleParams) {}

  record(metafile: Metafile, paths: ModulePaths): boolean {
    const edges = new MetafileEdges(metafile, paths.sourceRoot);
    const aliases = Object.entries(paths.settings.aliases).sort(
      ([a], [b]) => b.length - a.length,
    );
    const configuration = path.resolve(
      this.params.sourceRoot,
      this.params.configurationDirectory,
    );
    const directories = new Set<string>();
    const files = new Set<string>();
    let stagedBytes = 0;
    const stage = (set: Set<string>, file: string): boolean => {
      if (set.has(file)) return true;
      if (!directories.has(file) && !files.has(file)) {
        const bytes = 2 * Buffer.byteLength(JSON.stringify(file)) + 128;
        if (bytes > EVIDENCE_LIMIT - stagedBytes) return false;
        stagedBytes += bytes;
      }
      set.add(file);
      return true;
    };
    try {
      for (const [file, input] of Object.entries(metafile.inputs)) {
        if (
          !path.isAbsolute(file) ||
          edges.own(file) ||
          file.split(path.sep).includes("node_modules")
        )
          continue;
        for (const edge of input.imports) {
          if (
            edge.external ||
            edge.original === undefined ||
            !bareSpecifier(edge.original)
          )
            continue;
          const selection = edges.selection(edge.path);
          if (selection.kind === "own") continue;
          const request = resolutionRequest(
            edge.original,
            path.dirname(file),
            aliases,
            configuration,
          );
          if (
            request.kind !== "lookup" ||
            (!bareSpecifier(request.name) && !path.isAbsolute(request.name))
          )
            continue;
          const config = this.scope(request.directory, paths);
          if (!config) continue;
          let configured = false;
          let selected = false;
          let contained = false;
          for (const base of candidates(config, request.name)) {
            configured = true;
            if (selection.kind === "unknown") return false;
            const kind = mappedSelection(
              base,
              selection.file,
              paths.settings.resolveExtensions,
            );
            if (kind === "file") {
              selected = true;
              break;
            }
            if (!stage(directories, path.dirname(base))) return false;
            if (kind === "directory") {
              selected = true;
              break;
            }
            if (kind === "contained") contained = true;
            if (
              !stage(directories, base) ||
              !stage(files, path.join(base, "package.json"))
            )
              return false;
          }
          if (
            configured &&
            !selected &&
            !contained &&
            (selection.kind === "unknown" ||
              (!selection.file.split(path.sep).includes("node_modules") &&
                !paths.dependencyDirectory(selection.file)))
          )
            return false;
        }
      }
      for (const directory of directories) paths.name(directory);
      for (const file of files) {
        paths.name(file);
        const stat = fs.statSync(file, { throwIfNoEntry: false });
        if (stat && !stat.isFile()) return false;
      }
    } catch {
      return false;
    }
    for (const directory of directories) paths.lookupDirectories.add(directory);
    for (const file of files) paths.lookupFiles.add(file);
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
