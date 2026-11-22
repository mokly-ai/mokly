import fs from "node:fs";
import path from "node:path";

import type { ImportKind } from "esbuild";

import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import type { PathSettings } from "./config-inputs.js";
import { missingFile } from "./file-digests.js";
import { folderRowBytes } from "./folder-candidates.js";
import { FolderSelectionProof } from "./folder-selection-proof.js";
import { markedFileEvidence } from "./marked-file-evidence.js";
import type { SelectedImport } from "./metafile-edges.js";
import type { ModulePaths } from "./module-paths.js";
import { PackageFolders } from "./package-folders.js";
import { packageFolderFiles } from "./package-map.js";
import { EVIDENCE_LIMIT } from "./physical-input-reader.js";
import { PhysicalInputs } from "./physical-inputs.js";
import { lexicalLinkTarget } from "./physical-link-target.js";
import { pnpFiles } from "./pnp-files.js";
import { PnpLocations } from "./pnp-locations.js";
import type { LookupRequest } from "./resolution-request.js";

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

  private readonly folders: PackageFolders;
  private readonly directories = new Set<string>();
  private readonly files = new Set<string>();
  private readonly links = new Set<string>();
  private readonly proofs = new Map<string, FolderSelectionProof>();
  private bytes = 0;
  private folder = false;

  constructor(
    private readonly paths: ModulePaths,
    private readonly configuration: string,
    cachedScope: (directory: string) => PathSettings | undefined,
  ) {
    this.folders = new PackageFolders(
      this.inputs,
      paths,
      new PnpLocations(this.inputs, configuration, paths),
      undefined,
      true,
      false,
      cachedScope,
    );
  }

  private stage(set: Set<string>, file: string): void {
    if (set.has(file)) return;
    if (
      !this.directories.has(file) &&
      !this.files.has(file) &&
      !this.links.has(file)
    ) {
      this.bytes += folderRowBytes(file);
      if (this.bytes > EVIDENCE_LIMIT)
        throw new Error("package folder lookup limit");
    }
    if (set === this.directories) this.paths.name(file);
    set.add(file);
  }

  accept(
    request: LookupRequest,
    selection: SelectedImport,
    kind: ImportKind,
  ): boolean {
    try {
      const found = this.folders.lookup(
        request.name,
        request.directory,
        selection.kind === "physical" ? selection.file : undefined,
      );
      if (found && (!found.placed || found.candidates?.overflow)) return false;
      if (!found?.candidates?.present) return true;
      if (selection.kind !== "physical") return false;
      const key = JSON.stringify([request, selection.file, kind]);
      if (!this.proofs.has(key)) {
        const bases = [...found.candidates.targets()];
        this.bytes += Buffer.byteLength(JSON.stringify([key, bases]));
        if (this.bytes > EVIDENCE_LIMIT) return false;
        this.proofs.set(
          key,
          new FolderSelectionProof(
            bases,
            selection.file,
            kind,
            this.inputs,
            this.paths,
          ),
        );
      }
      this.folder = true;
      for (const base of found.candidates.values) {
        this.stage(this.directories, path.dirname(base));
        this.stage(this.directories, base);
        this.stage(this.files, path.join(base, "package.json"));
        for (const file of packageFolderFiles(
          base,
          this.paths.settings.resolveExtensions,
        ))
          if (link(file)) {
            const target = lexicalLinkTarget(file, (candidate) =>
              this.stage(this.links, candidate),
            );
            if (brokenLink(file)) this.stage(this.files, target);
          }
      }
      for (const manifest of found.manifests) this.stage(this.files, manifest);
      return true;
    } catch {
      return false;
    }
  }

  finish(): ReuseEvidence | undefined {
    try {
      if (this.folder || this.folders.registry)
        for (const { file } of pnpFiles(this.configuration)) {
          this.inputs.file(file);
          this.stage(this.files, file);
        }
      if (!this.inputs.complete) return undefined;
    } catch {
      return undefined;
    }
    const evidence = markedFileEvidence(this.inputs, this.files, this.links);
    if (!evidence) return undefined;
    for (const directory of this.directories)
      this.paths.lookupDirectories.add(directory);
    return evidence;
  }

  async certify(
    listings: Record<string, string[]>,
    evidence: ReuseEvidence,
  ): Promise<boolean> {
    for (const proof of this.proofs.values())
      if (!(await proof.matches(listings, evidence))) return false;
    return true;
  }
}
