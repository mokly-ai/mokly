import type { ManifestEntry } from "@mokly/viewer/data";
import type { ShellContext } from "@mokly/viewer/server";

import type { ComponentRuntime } from "../build/component_runtime.js";

type EligibleManifestEntry = Extract<
  ManifestEntry,
  { kind: "component" | "screen" }
>;

/** Current runtime eligibility paired with one shell request. */
export interface WorkspaceEligibilitySource {
  entries: Readonly<Record<string, boolean>>;
  generation: string;
  reporter: WorkspaceEligibilityReporter;
}

/** Diagnostic boundary for missing route eligibility. */
export interface WorkspaceEligibilityReporter {
  missing(entry: EligibleManifestEntry, generation: string): void;
}

/** Report each missing entry once while retaining only recent generations. */
export class ServeWorkspaceEligibility implements WorkspaceEligibilityReporter {
  private readonly reported = new Map<string, Set<string>>();

  constructor(
    private readonly onDiagnostic: (error: unknown) => void = () => undefined,
  ) {}

  source(
    runtime: Pick<ComponentRuntime, "generation" | "interactiveEntries">,
  ): WorkspaceEligibilitySource {
    return {
      entries: runtime.interactiveEntries,
      generation: runtime.generation,
      reporter: this,
    };
  }

  missing(entry: EligibleManifestEntry, generation: string): void {
    let entries = this.reported.get(generation);
    if (!entries) {
      entries = new Set();
      this.reported.set(generation, entries);
      while (this.reported.size > 2) {
        const oldest = this.reported.keys().next().value as string | undefined;
        if (oldest) this.reported.delete(oldest);
      }
    }
    if (entries.has(entry.id)) return;
    entries.add(entry.id);
    this.onDiagnostic(
      new WorkspaceEligibilityDiagnostic(entry.id, entry.route, generation),
    );
  }
}

/** Resolve private eligibility without making Static browsing depend on Live. */
export function resolvedWorkspaceInteractive(
  entry: ManifestEntry | undefined,
  removed: boolean,
  source: WorkspaceEligibilitySource | undefined,
): ShellContext["workspaceInteractive"] | undefined {
  if (
    !source ||
    removed ||
    (entry?.kind !== "screen" && entry?.kind !== "component")
  )
    return;
  const value = source.entries[entry.id];
  if (typeof value !== "boolean") {
    source.reporter.missing(entry, source.generation);
    return;
  }
  return { entryId: entry.id, route: entry.route, value };
}

class WorkspaceEligibilityDiagnostic extends Error {
  constructor(entryId: string, route: string, generation: string) {
    super(
      `Live runtime generation ${generation} is missing eligibility for ${entryId} at ${route}; Static remains available and Live is unavailable.`,
    );
    this.name = "WorkspaceEligibilityDiagnostic";
  }
}
