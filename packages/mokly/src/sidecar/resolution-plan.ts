import type { PlannedImport } from "../generated/sidecar/PlannedImport.js";
import type { PlannedImportKind } from "../generated/sidecar/PlannedImportKind.js";
import type { ResolutionPlan } from "../generated/sidecar/ResolutionPlan.js";

import { protocol } from "./errors.js";

/** Intern physical paths while native classification builds indexed imports. */
export class PlanBuilder {
  private readonly paths = new Map<string, number>();
  private readonly imports = new Map<string, number>();

  constructor(readonly plan: ResolutionPlan = { paths: [], imports: [] }) {
    plan.paths.forEach((file, index) => this.paths.set(file, index));
    plan.imports.forEach(([importer, specifier, kind], index) =>
      this.imports.set(importKey(importer, specifier, kind), index),
    );
  }

  /** Return one shared table position for an importer, target, or directory. */
  path(file: string): number {
    const existing = this.paths.get(file);
    if (existing !== undefined) return existing;
    const index = this.plan.paths.length;
    this.paths.set(file, index);
    this.plan.paths.push(file);
    return index;
  }

  addImport(
    importer: string,
    specifier: string,
    kind: PlannedImportKind,
    target: string,
    sideEffects: boolean,
  ): void {
    const entry: PlannedImport = [
      this.path(importer),
      specifier,
      kind,
      this.path(target),
      sideEffects,
    ];
    const key = importKey(entry[0], specifier, kind);
    const existing = this.imports.get(key);
    if (existing !== undefined) this.plan.imports[existing] = entry;
    else {
      this.imports.set(key, this.plan.imports.length);
      this.plan.imports.push(entry);
    }
  }
}

/** Index a plan by numeric path references without expanding absolute-path keys. */
export class PlanLookup {
  private readonly paths = new Map<string, number>();
  private readonly imports = new Map<string, PlannedImport>();

  constructor(readonly plan: ResolutionPlan) {
    plan.paths.forEach((file, index) => this.paths.set(file, index));
    for (const entry of plan.imports) {
      const [importer, specifier, kind, target] = entry;
      if (
        plan.paths[importer] === undefined ||
        plan.paths[target] === undefined
      )
        protocol("invalid resolution plan reference");
      this.imports.set(importKey(importer, specifier, kind), entry);
    }
  }

  get(
    importer: string,
    specifier: string,
    kind: PlannedImportKind,
  ): PlannedImport | undefined {
    const index = this.paths.get(importer);
    return index === undefined
      ? undefined
      : this.imports.get(importKey(index, specifier, kind));
  }
}

function importKey(
  importer: number,
  specifier: string,
  kind: PlannedImportKind,
): string {
  return JSON.stringify([importer, specifier, kind]);
}
