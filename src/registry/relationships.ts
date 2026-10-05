import type { ResolvedRegistryEntry } from "../authoring/types.js";

import { problem } from "./entry_metadata.js";
import type { RegistryViolation } from "./prepared_types.js";
import { crossReferenceVariantViolations } from "./variant_validation.js";

/** Validate navigation paths and reciprocal use-case references. */
export function crossReferenceViolations(
  entries: readonly ResolvedRegistryEntry[],
): RegistryViolation[] {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const violations: RegistryViolation[] = [];
  for (const entry of entries) {
    if (entry.kind === "use-case") {
      if (!Array.isArray(entry.steps)) continue;
      validateUseCase(entry, byPath, violations);
    } else if (entry.kind === "screen") {
      if (!Array.isArray(entry.useCasePaths)) continue;
      validateScreen(entry, byPath, violations);
    }
  }
  violations.push(...crossReferenceVariantViolations(entries, byPath));
  return violations;
}

function validateUseCase(
  entry: Extract<ResolvedRegistryEntry, { kind: "use-case" }>,
  byPath: ReadonlyMap<string, ResolvedRegistryEntry>,
  violations: RegistryViolation[],
): void {
  for (const [index, step] of entry.steps.entries()) {
    if (!record(step) || typeof step.screenPath !== "string") continue;
    const target = byPath.get(step.screenPath);
    if (target?.kind !== "screen") {
      violations.push(
        problem(
          entry,
          "missing-step-screen",
          `step #${index + 1} is not a screen: ${step.screenPath}`,
        ),
      );
    } else if (
      Array.isArray(target.useCasePaths) &&
      !target.useCasePaths.includes(entry.path)
    ) {
      violations.push(
        problem(
          entry,
          "missing-membership",
          `screen ${target.path} must list use case ${entry.path}`,
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
  byPath: ReadonlyMap<string, ResolvedRegistryEntry>,
  violations: RegistryViolation[],
): void {
  for (const useCasePath of entry.useCasePaths) {
    if (typeof useCasePath !== "string") continue;
    const target = byPath.get(useCasePath);
    if (target?.kind !== "use-case") {
      violations.push(
        problem(
          entry,
          "missing-use-case",
          `unknown use-case path: ${useCasePath}`,
        ),
      );
    } else if (
      Array.isArray(target.steps) &&
      !target.steps.some(
        (step) => record(step) && step.screenPath === entry.path,
      )
    ) {
      violations.push(
        problem(
          entry,
          "missing-step",
          `use case ${useCasePath} must reference screen ${entry.path}`,
        ),
      );
    }
  }
}
