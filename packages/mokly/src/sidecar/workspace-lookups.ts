import fs from "node:fs";
import path from "node:path";

import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import { missingFile } from "./file-digests.js";
import { markedFileEvidence } from "./marked-file-evidence.js";
import type { ModulePaths } from "./module-paths.js";
import { EVIDENCE_LIMIT } from "./physical-input-reader.js";
import { PhysicalInputs } from "./physical-inputs.js";
import type { WorkspaceSourceFiles } from "./workspace-sources.js";

/** Keep file probes on the selected side and observe them before resolving. */
export class WorkspaceLookups implements WorkspaceSourceFiles {
  private capture = new PhysicalInputs();
  private readonly probed = new Map<string, string | null>();
  private readonly directories = new Map<string, boolean>();

  constructor(private readonly paths: ModulePaths) {}

  recordInto(capture: PhysicalInputs): void {
    this.capture = capture;
  }

  regular(file: string): string | undefined {
    const previous = this.probed.get(file);
    if (previous !== undefined) return previous ?? undefined;
    const real = this.probe(file);
    this.probed.set(file, real ?? null);
    return real;
  }

  private probe(file: string): string | undefined {
    const directory = path.dirname(file);
    if (!this.confined(directory)) {
      this.capture.complete = false;
      return;
    }
    this.paths.lookupDirectories.add(directory);
    let real: string | undefined;
    try {
      real = fs.realpathSync.native(file);
      if (!this.paths.repositoryOwned(real) || !fs.statSync(real).isFile()) {
        this.capture.complete = false;
        return;
      }
    } catch (error) {
      if (!missingFile(error)) {
        this.capture.complete = false;
        return;
      }
      real = undefined;
    }
    this.paths.lookupFiles.add(file);
    if (this.capture.canonicalFile(file) !== real)
      this.capture.complete = false;
    return real;
  }

  private confined(directory: string): boolean {
    const previous = this.directories.get(directory);
    if (previous !== undefined) return previous;
    let confined: boolean;
    try {
      confined = this.paths.repositoryOwned(fs.realpathSync.native(directory));
    } catch (error) {
      const parent = path.dirname(directory);
      confined =
        missingFile(error) && parent !== directory && this.confined(parent);
    }
    this.directories.set(directory, confined);
    return confined;
  }

  read(file: string): string {
    if (this.capture.file(file, true)?.kind === "file") {
      const snapshot = this.capture.inspectMetadata(file)?.bytes;
      if (snapshot) return snapshot.toString("utf8");
    }
    this.capture.complete = false;
    return fs.readFileSync(file, "utf8");
  }

  marked(evidence: ReuseEvidence | undefined): ReuseEvidence | undefined {
    if (!evidence || !this.capture.complete) return undefined;
    if (!this.probed.size) return evidence;
    const workspace = markedFileEvidence(this.capture, this.probed.keys());
    if (!workspace) return undefined;
    const combined = {
      ...evidence,
      inputs: { ...evidence.inputs, ...workspace.inputs },
    };
    return Buffer.byteLength(JSON.stringify(combined)) <= EVIDENCE_LIMIT
      ? combined
      : undefined;
  }
}
