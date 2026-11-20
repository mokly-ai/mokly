import path from "node:path";

import { version } from "esbuild";
import type { Metafile } from "esbuild";

import type { ModuleResolution } from "../generated/sidecar/ModuleResolution.js";
import type { ResolutionPlan } from "../generated/sidecar/ResolutionPlan.js";
import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import { stringBytes } from "./captured-plan.js";
import type { PathSettings } from "./config-inputs.js";
import { substitution } from "./path-pattern.js";
import type { PhysicalInputObserver } from "./physical-input-observer.js";
import { EVIDENCE_LIMIT } from "./physical-input-reader.js";
import { candidateDirectories } from "./plan-candidate-directories.js";
import { candidateMetadata } from "./plan-candidate-metadata.js";
import { bareSpecifier } from "./specifier.js";

const fixed = [
  "node_modules",
  "package.json",
  "tsconfig.json",
  "jsconfig.json",
  ".pnp.data.json",
  ".pnp.cjs",
  ".pnp.js",
];

/** Bounded lookup names affect only the optional plan's directory comparisons. */
export class PlanCandidates implements PhysicalInputObserver {
  private readonly names = new Map<string, Set<string>>();
  private readonly redirects = new Map<string, string>();
  private readonly blocked = new Set<string>();
  private readonly selectedTargets = new Set<string>();
  private readonly extensions: readonly string[];
  private bytes = 0;
  private overflow = false;
  private proved = version === "0.28.2";

  constructor(private readonly settings: ModuleResolution) {
    this.extensions = settings.resolveExtensions.length
      ? settings.resolveExtensions
      : [".tsx", ".ts", ".jsx", ".js", ".css", ".json"];
    if (
      this.extensions.some(
        (extension) => /[/\\]/.test(extension) || extension.includes("\0"),
      )
    )
      this.proved = false;
  }

  request(name: string, config: PathSettings): void {
    if (name.includes("\\") || name.includes("\0")) this.proved = false;
    if (/[%?#]/.test(name) && bareSpecifier(name)) this.proved = false;
    if (!config.paths) return;
    for (const [pattern, targets] of Object.entries(config.paths.targets)) {
      const matched = substitution(pattern, name);
      if (matched === undefined) continue;
      if (path.isAbsolute(name)) this.proved = false;
      for (const target of targets) {
        if (/[?#\\]/.test(target)) this.proved = false;
        if (!this.fits(target.length + matched.length + 1)) return;
        this.relative(
          config.baseUrl ?? config.paths.directory,
          pattern.includes("*") ? target.replace("*", () => matched) : target,
        );
      }
    }
  }

  path(file: string): void {
    if (!this.active()) return;
    if (/[/\\]__virtual__(?:[/\\]|$)|\.zip(?:[/\\]|$)/.test(file))
      this.proved = false;
    while (this.active()) {
      const parent = path.dirname(file);
      if (parent === file) break;
      this.add(parent, path.basename(file));
      file = parent;
    }
  }

  candidate(base: string): void {
    if (!this.active()) return;
    this.file(base);
    const suffix = base.search(/[?#]/);
    if (suffix >= 0) this.file(base.slice(0, suffix));
  }

  private file(base: string): void {
    this.path(base);
    const directory = path.dirname(base);
    const name = path.basename(base);
    this.add(directory, name);
    for (const extension of this.extensions) {
      if (
        !this.fits(name.length + extension.length + 2) ||
        !this.fits(5 + extension.length + 2)
      )
        return;
      this.add(directory, name + extension);
      this.add(base, "index" + extension);
    }
    this.add(base, "index");
    const extension = name.slice(name.lastIndexOf("."));
    const substitutions =
      extension === ".js" || extension === ".jsx"
        ? [".ts", ".tsx"]
        : extension === ".mjs"
          ? [".mts"]
          : extension === ".cjs"
            ? [".cts"]
            : [];
    for (const replacement of substitutions) {
      if (!this.fits(name.length - extension.length + replacement.length + 2))
        return;
      this.add(directory, name.slice(0, -extension.length) + replacement);
    }
  }

  private relative(directory: string, name: string): void {
    if (this.fits(directory.length + name.length + 2))
      this.candidate(path.resolve(directory, name));
  }

  directory(lexical: string, canonical: string): void {
    this.link(lexical, canonical);
  }

  link(lexical: string, canonical: string): void {
    if (!this.active()) return;
    this.path(canonical);
    if (lexical === canonical || this.redirects.has(lexical)) return;
    if (this.retain(lexical, 3) && this.retain(canonical, 1))
      this.redirects.set(lexical, canonical);
  }

  metadata(file: string, bytes: Buffer): void {
    if (
      this.active() &&
      !candidateMetadata(
        file,
        bytes,
        this.settings.mainFields,
        (directory, name) => this.relative(directory, name),
      )
    )
      this.proved = false;
  }

  metafile(metafile: Metafile): void {
    if (
      Object.values(metafile.inputs).some((input) =>
        input.imports.some((edge) => edge.path.includes("*")),
      )
    )
      this.proved = false;
  }

  selected(file: string): void {
    if (
      this.active() &&
      !this.selectedTargets.has(file) &&
      this.retain(file, 1)
    )
      this.selectedTargets.add(file);
  }

  unproved(): void {
    this.proved = false;
  }

  attach(
    plan: ResolutionPlan | undefined,
    evidence: ReuseEvidence,
  ): ResolutionPlan | undefined {
    if (!plan || this.overflow || !this.proved) return plan;
    return candidateDirectories(plan, evidence, {
      names: this.names,
      blocked: this.blocked,
      selected: this.selectedTargets,
      canonical: (directory) => this.canonical(directory),
      retain: (value, bytes) => this.retain(value, bytes),
      reserve: (bytes) => this.budget(bytes),
    });
  }

  private canonical(directory: string): string {
    for (let current = directory; ;) {
      const target = this.redirects.get(current);
      if (target) {
        const tail = path.relative(current, directory);
        return this.fits(target.length + tail.length + 2)
          ? path.join(target, tail)
          : directory;
      }
      const parent = path.dirname(current);
      if (parent === current) return directory;
      current = parent;
    }
  }

  private active(): boolean {
    return this.proved && !this.overflow;
  }

  private fits(bytes: number): boolean {
    if (bytes > EVIDENCE_LIMIT - this.bytes) this.overflow = true;
    return !this.overflow;
  }

  private budget(bytes: number): boolean {
    if (!this.fits(bytes)) return false;
    this.bytes += bytes;
    return true;
  }

  private retain(value: string, containerBytes: number): boolean {
    const bytes = stringBytes(
      value,
      EVIDENCE_LIMIT - this.bytes - containerBytes,
    );
    if (bytes === undefined) this.overflow = true;
    return bytes !== undefined && this.budget(bytes + containerBytes);
  }

  private add(directory: string, name: string): boolean {
    if (!this.active()) return false;
    if (!name) {
      this.proved = false;
      return false;
    }
    let names = this.names.get(directory);
    if (!names) {
      if (!this.retain(directory, 4)) return false;
      names = new Set();
      this.names.set(directory, names);
      for (const name of fixed) this.add(directory, name);
    }
    if (Buffer.byteLength(name) !== name.length || /[/\\]/.test(name)) {
      if (!this.blocked.has(directory) && this.retain(directory, 1))
        this.blocked.add(directory);
      return false;
    }
    const bytes = stringBytes(name, EVIDENCE_LIMIT - this.bytes - 1);
    if (bytes === undefined) {
      this.overflow = true;
      return false;
    }
    const folded = name.toLowerCase();
    if (names.has(folded)) return false;
    if (!this.budget(bytes + 1)) return false;
    names.add(folded);
    return true;
  }
}
