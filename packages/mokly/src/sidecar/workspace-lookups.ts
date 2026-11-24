import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import { missingFile } from "./file-digests.js";
import { markedFileEvidence } from "./marked-file-evidence.js";
import type { ModulePaths } from "./module-paths.js";
import { EVIDENCE_LIMIT } from "./physical-input-reader.js";
import { PhysicalInputs } from "./physical-inputs.js";
import type { WorkspaceSourceFiles } from "./workspace-sources.js";

type Probe =
  { kind: "file"; real: string } | { kind: "absent" } | { kind: "unavailable" };

/** Keep file probes on the selected side and observe them before resolving. */
export class WorkspaceLookups implements WorkspaceSourceFiles {
  readonly absences = new Set<string>();
  private capture = new PhysicalInputs();
  private readonly probed = new Map<string, Probe>();
  private readonly directories = new Map<string, boolean>();
  private readonly digests = new Map<string, string>();
  private readonly observed = new Set<string>();
  private readonly metadataFiles = new Set<string>();

  constructor(private readonly paths: ModulePaths) {}

  recordInto(capture: PhysicalInputs): void {
    this.capture = capture;
  }

  regular(file: string): string | undefined {
    const result = this.probe(file);
    return result.kind === "file" ? result.real : undefined;
  }

  private probe(file: string): Probe {
    const previous = this.probed.get(file);
    if (previous !== undefined) return previous;
    const result = this.check(file);
    this.probed.set(file, result);
    return result;
  }

  private check(file: string): Probe {
    if (!this.confined(path.dirname(file))) return { kind: "unavailable" };
    try {
      const real = fs.realpathSync.native(file);
      return this.paths.repositoryOwned(real) && fs.statSync(real).isFile()
        ? { kind: "file", real }
        : { kind: "unavailable" };
    } catch (error) {
      return { kind: missingFile(error) ? "absent" : "unavailable" };
    }
  }

  private observe(file: string): Probe {
    const result = this.probe(file);
    if (result.kind === "unavailable") {
      this.capture.complete = false;
      return result;
    }
    if (this.observed.has(file)) return result;
    this.observed.add(file);
    const expected = result.kind === "file" ? result.real : undefined;
    if (this.capture.canonicalFile(file) !== expected)
      this.capture.complete = false;
    return result;
  }

  metadata(file: string): void {
    if (this.metadataFiles.has(file)) return;
    this.metadataFiles.add(file);
    const result = this.observe(file);
    if (result.kind === "unavailable") return;
    this.paths.lookupFiles.add(file);
    if (result.kind !== "file") return;
    const observed = this.capture.file(result.real, true);
    const digest = this.digests.get(result.real);
    if (
      observed?.kind !== "file" ||
      (digest !== undefined && observed.digest !== digest)
    )
      this.capture.complete = false;
  }

  candidate(file: string): string | undefined {
    const result = this.observeCandidate(file);
    if (result.kind === "file") return result.real;
  }

  buildTarget(file: string): boolean {
    return this.observeCandidate(file).kind !== "unavailable";
  }

  /** Retain package search paths and links in private reuse evidence. */
  packageLookup(file: string): void {
    this.observed.add(file);
    this.capture.file(file);
  }

  private observeCandidate(file: string): Probe {
    const result = this.observe(file);
    if (result.kind !== "unavailable")
      this.paths.lookupDirectories.add(path.dirname(file));
    if (result.kind === "absent") this.absences.add(file);
    return result;
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
    const bytes = fs.readFileSync(file);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const previous = this.digests.get(file);
    if (previous !== undefined && previous !== digest)
      this.capture.complete = false;
    this.digests.set(file, digest);
    return bytes.toString("utf8");
  }

  marked(evidence: ReuseEvidence | undefined): ReuseEvidence | undefined {
    if (!evidence || !this.capture.complete) return undefined;
    if (!this.observed.size) return evidence;
    const workspace = markedFileEvidence(this.capture, this.observed);
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
