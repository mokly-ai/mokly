import { analyzeHierarchy } from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";

import { problem } from "./entry_metadata.js";
import type { RegistryViolation } from "./prepared_types.js";

/** Validate collection and reciprocal use-case references. */
export function crossReferenceViolations(
  entries: readonly ResolvedRegistryEntry[],
): RegistryViolation[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const violations: RegistryViolation[] = analyzeHierarchy(entries).issues.map(
    (issue) => problem(issue.entry, issue.code, issue.message),
  );
  for (const entry of entries) {
    if (entry.kind === "use-case") {
      if (!Array.isArray(entry.steps)) continue;
      validateUseCase(entry, byId, violations);
    } else if (entry.kind === "screen") {
      if (!Array.isArray(entry.useCaseIds)) continue;
      validateScreen(entry, byId, violations);
    }
  }
  return violations;
}

/** Find duplicate ids or routed values. */
export function duplicateViolations(
  entries: readonly ResolvedRegistryEntry[],
  field: "id" | "route",
): RegistryViolation[] {
  const groups = new Map<string, ResolvedRegistryEntry[]>();
  for (const entry of entries) {
    const value =
      field === "id"
        ? entry.id
        : entry.kind === "collection"
          ? undefined
          : entry.route;
    if (value) groups.set(value, [...(groups.get(value) ?? []), entry]);
  }
  return [...groups.entries()].flatMap(([value, group]) =>
    group.length > 1
      ? group.map((entry) =>
          problem(
            entry,
            `duplicate-${field}`,
            `${field} "${value}" is defined more than once`,
          ),
        )
      : [],
  );
}

function validateUseCase(
  entry: Extract<ResolvedRegistryEntry, { kind: "use-case" }>,
  byId: ReadonlyMap<string, ResolvedRegistryEntry>,
  violations: RegistryViolation[],
): void {
  for (const [index, step] of entry.steps.entries()) {
    if (!record(step) || typeof step.screenId !== "string") continue;
    const target = byId.get(step.screenId);
    if (target?.kind !== "screen") {
      violations.push(
        problem(
          entry,
          "missing-step-screen",
          `step #${index + 1} is not a screen: ${step.screenId}`,
        ),
      );
    } else if (!target.useCaseIds.includes(entry.id)) {
      violations.push(
        problem(
          entry,
          "missing-membership",
          `screen ${target.id} must list use case ${entry.id}`,
        ),
      );
    }
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateScreen(
  entry: Extract<ResolvedRegistryEntry, { kind: "screen" }>,
  byId: ReadonlyMap<string, ResolvedRegistryEntry>,
  violations: RegistryViolation[],
): void {
  for (const useCaseId of entry.useCaseIds) {
    const target = byId.get(useCaseId);
    if (target?.kind !== "use-case") {
      violations.push(
        problem(entry, "missing-use-case", `unknown use-case id: ${useCaseId}`),
      );
    } else if (!target.steps.some((step) => step.screenId === entry.id)) {
      violations.push(
        problem(
          entry,
          "missing-step",
          `use case ${useCaseId} must reference screen ${entry.id}`,
        ),
      );
    }
  }
}
