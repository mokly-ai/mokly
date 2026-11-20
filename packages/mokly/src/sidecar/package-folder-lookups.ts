import fs from "node:fs";
import path from "node:path";

import type { Metafile } from "esbuild";

import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import { missingFile } from "./file-digests.js";
import { markedFileEvidence } from "./marked-file-evidence.js";
import { MetafileEdges } from "./metafile-edges.js";
import type { ModulePaths } from "./module-paths.js";
import { PackageFolders } from "./package-folders.js";
import { packageFolderFiles } from "./package-map.js";
import { EVIDENCE_LIMIT } from "./physical-input-reader.js";
import { PhysicalInputs } from "./physical-inputs.js";
import { pnpFiles } from "./pnp-files.js";
import { PnpLocations } from "./pnp-locations.js";
import { resolutionRequest } from "./resolution-request.js";
import { bareSpecifier } from "./specifier.js";

function link(file: string): boolean {
  try {
    return (
      fs.lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink() ?? false
    );
  } catch (error) {
    if (!missingFile(error)) throw error;
    return false;
  }
}

function brokenLink(file: string): boolean {
  if (!link(file)) return false;
  try {
    return fs.statSync(file, { throwIfNoEntry: false }) === undefined;
  } catch (error) {
    if (!missingFile(error)) throw error;
    return true;
  }
}

/** Stage the shared candidates only for imports selected through a package folder map. */
export class PackageFolderLookups {
  private readonly inputs = new PhysicalInputs();

  constructor(private readonly paths: ModulePaths) {}

  record(metafile: Metafile, configuration: string): ReuseEvidence | undefined {
    const folders = new PackageFolders(
      this.inputs,
      this.paths,
      new PnpLocations(this.inputs, configuration),
    );
    const edges = new MetafileEdges(metafile, this.paths.sourceRoot);
    const aliases = Object.entries(this.paths.settings.aliases).sort(
      ([a], [b]) => b.length - a.length,
    );
    const directories = new Set<string>();
    const files = new Set<string>();
    let bytes = 0;
    const stage = (set: Set<string>, file: string) => {
      if (set.has(file)) return;
      if (!directories.has(file) && !files.has(file)) {
        bytes += 2 * Buffer.byteLength(JSON.stringify(file)) + 128;
        if (bytes > EVIDENCE_LIMIT)
          throw new Error("package folder lookup limit");
      }
      if (set === directories) this.paths.name(file);
      set.add(file);
    };
    try {
      for (const [file, input] of Object.entries(metafile.inputs)) {
        if (!path.isAbsolute(file) || edges.own(file)) continue;
        for (const edge of input.imports) {
          if (edge.external || edge.original === undefined) continue;
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
            (!bareSpecifier(request.name) && !request.name.startsWith("#"))
          )
            continue;
          const found = folders.lookup(
            request.name,
            request.directory,
            selection.kind === "physical" ? selection.file : undefined,
          );
          if (!found?.candidates.length) continue;
          if (!found.placed) return undefined;
          for (const base of found.candidates) {
            stage(directories, path.dirname(base));
            stage(directories, base);
            stage(files, path.join(base, "package.json"));
            for (const file of packageFolderFiles(
              base,
              this.paths.settings.resolveExtensions,
            ))
              if (brokenLink(file)) {
                const seen = new Set([file]);
                let target = file;
                do {
                  target = path.resolve(
                    path.dirname(target),
                    fs.readlinkSync(target),
                  );
                  if (seen.has(target)) throw new Error("candidate link cycle");
                  seen.add(target);
                  if (!link(target)) stage(files, target);
                } while (link(target));
              }
          }
          for (const manifest of found.manifests) stage(files, manifest);
          for (const { file } of pnpFiles(configuration)) {
            this.inputs.file(file);
            stage(files, file);
          }
        }
      }
      if (!this.inputs.complete) return undefined;
    } catch {
      return undefined;
    }
    const evidence = markedFileEvidence(this.inputs, files);
    if (!evidence) return undefined;
    for (const directory of directories)
      this.paths.lookupDirectories.add(directory);
    return evidence;
  }
}
