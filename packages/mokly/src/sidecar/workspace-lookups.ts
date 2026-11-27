import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import { missingFile } from "./file-digests.js";
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
  private readonly buildFiles = new Set<string>();

  constructor(private readonly paths: ModulePaths) {}

  recordInto(capture: PhysicalInputs): void {
    this.capture = capture;
  }

  regular(file: string): string | undefined {
    const result = this.observeFile(file);
    return result.kind === "file" ? result.real : undefined;
  }

  /** Record the manifest digest or absence when the caller needs lookup evidence. */
  manifest(file: string, record: boolean): string | null | undefined {
    const result = this.probe(file);
    try {
      return result.kind === "file" ? this.contents(result.real) : undefined;
    } catch {
      return null;
    } finally {
      if (record) this.metadata(file);
    }
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
    if (this.observeFile(file).kind !== "unavailable")
      this.paths.lookupFiles.add(file);
  }

  private observeFile(file: string): Probe {
    const result = this.observe(file);
    if (result.kind === "unavailable") return result;
    if (result.kind === "absent") {
      if (this.capture.file(file, true)?.kind !== "absent")
        this.capture.complete = false;
      return result;
    }
    const observed = this.capture.file(result.real, true);
    const digest = this.digests.get(result.real);
    if (
      observed?.kind !== "file" ||
      (digest !== undefined && observed.digest !== digest)
    )
      this.capture.complete = false;
    return result;
  }

  candidate(file: string): string | undefined {
    const result = this.observeCandidate(file);
    if (result.kind === "file") return result.real;
  }

  buildTarget(file: string): boolean {
    const result = this.observeCandidate(file);
    if (this.capture.complete && result.kind === "file")
      this.buildFiles.add(result.real);
    return result.kind !== "unavailable";
  }

  /** Retain package search paths and links in private reuse evidence. */
  packageLookup(file: string): void {
    this.capture.file(file);
  }

  /** Compare the bytes of the installed manifest and retain its lookup path. */
  installationManifest(file: string): string | undefined {
    this.packageLookup(file);
    const captured = this.capture.inspectMetadata(file);
    if (captured) return captured.bytes?.toString("utf8");
    try {
      return fs.readFileSync(file, "utf8");
    } catch (error) {
      if (!missingFile(error)) throw error;
    }
  }

  /** Keep native resolution targets and links without reading their contents. */
  nativeTarget(file: string): string | undefined {
    const captured = this.capture.canonicalFile(file);
    if (this.capture.complete) {
      if (captured !== undefined) this.buildFiles.add(captured);
      return captured;
    }
    try {
      return fs.realpathSync.native(file);
    } catch (error) {
      if (!missingFile(error)) throw error;
    }
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
    try {
      return this.contents(file);
    } finally {
      this.observeFile(file);
    }
  }

  private contents(file: string): string {
    const bytes = fs.readFileSync(file);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const previous = this.digests.get(file);
    if (previous !== undefined && previous !== digest)
      this.capture.complete = false;
    this.digests.set(file, digest);
    return bytes.toString("utf8");
  }

  /** Keep content evidence for workspace files that the restored require can load. */
  runtimeFiles(files: Iterable<string | null>): void {
    for (const file of files) {
      if (!file || !path.isAbsolute(file) || !this.paths.repositoryOwned(file))
        continue;
      if (this.capture.file(file)?.kind !== "file") {
        this.capture.complete = false;
        return;
      }
    }
  }

  /** An unresolved require may load any recorded workspace build. */
  runtimeBuilds(): void {
    this.runtimeFiles(this.buildFiles);
  }

  marked(evidence: ReuseEvidence | undefined): ReuseEvidence | undefined {
    if (!evidence || !this.capture.complete) return undefined;
    if (!this.capture.inputs.size) return evidence;
    const workspace = Object.fromEntries(this.capture.inputs);
    if (!this.capture.markedCurrent({ ...evidence, inputs: workspace }))
      return undefined;

    const inputs = { ...evidence.inputs };
    for (const [file, entry] of this.capture.inputs) {
      const prior = inputs[file];
      if (prior?.kind === "file" && entry.kind === "filePath") continue;
      if (
        prior &&
        !(prior.kind === "filePath" && entry.kind === "file") &&
        JSON.stringify(prior) !== JSON.stringify(entry)
      )
        return undefined;
      inputs[file] = entry;
    }
    const combined = { ...evidence, inputs };
    return Buffer.byteLength(JSON.stringify(combined)) <= EVIDENCE_LIMIT
      ? combined
      : undefined;
  }
}
