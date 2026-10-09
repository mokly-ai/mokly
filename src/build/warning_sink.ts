import { randomBytes } from "node:crypto";

import {
  normalizeBuildDiagnostics,
  type BuildDiagnostic,
} from "./build_warnings.js";
import type { GenerationWarning } from "./warning_generation.js";

/** Deduplicate one invocation or watched generation before terminal reporting. */
export class BuildWarningSink {
  private readonly seen = new Set<string>();
  private readonly pending = new Map<string, BuildDiagnostic>();
  private live = false;
  private currentGeneration = randomBytes(16).toString("hex");

  constructor(private readonly report: (warning: BuildDiagnostic) => void) {}

  get generation(): string {
    return this.currentGeneration;
  }

  /** Capture the attempt before asynchronous config or consumer preparation. */
  forGeneration(
    generation = this.generation,
  ): (warning: BuildDiagnostic) => void {
    return (warning) => this.addGeneration({ generation, warning });
  }

  addGeneration(event: GenerationWarning): void {
    if (event.generation === this.generation) this.add(event.warning);
  }

  add(warning: BuildDiagnostic): void {
    normalizeBuildDiagnostics([warning]);
    const key = this.key(warning);
    if (this.seen.has(key)) return;
    this.seen.add(key);
    if (this.live) this.report(warning);
    else this.pending.set(key, warning);
  }

  flush(): void {
    for (const warning of normalizeBuildDiagnostics(this.pending.values()))
      this.report(warning);
    this.pending.clear();
    this.live = true;
  }

  /** Merge a result without replaying records already streamed by this attempt. */
  complete(diagnostics: readonly BuildDiagnostic[]): void {
    for (const diagnostic of normalizeBuildDiagnostics(diagnostics))
      if (!this.seen.has(this.key(diagnostic))) this.add(diagnostic);
    this.flush();
  }

  private key(diagnostic: BuildDiagnostic): string {
    return JSON.stringify([
      diagnostic.code,
      diagnostic.route ?? null,
      diagnostic.subject?.kind ?? null,
      diagnostic.subject?.path ?? null,
      diagnostic.message,
    ]);
  }

  reset(): void {
    this.currentGeneration = randomBytes(16).toString("hex");
    this.seen.clear();
    this.pending.clear();
    this.live = false;
  }
}
