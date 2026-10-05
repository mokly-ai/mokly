import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { screenVariantAuthoring } from "../authoring/variants.js";

import { problem } from "./entry_metadata.js";
import type { RegistryViolation } from "./prepared_types.js";

/** Validate fields that can be checked on one prepared registry entry. */
export function variantEntryViolations(
  entry: ResolvedRegistryEntry,
): RegistryViolation[] {
  const violations: RegistryViolation[] = [];
  const variantOf = "variantOf" in entry ? entry.variantOf : undefined;
  if (typeof variantOf !== "string") return violations;
  const authoring =
    entry.kind === "screen" ? screenVariantAuthoring(entry) : undefined;
  for (const field of authoring?.forbiddenFields ?? []) {
    violations.push(
      problem(entry, "invalid-variants", `a variant cannot declare ${field}`),
    );
  }
  return violations;
}

/** Validate variant parents and inherited paths. */
export function crossReferenceVariantViolations(
  entries: readonly ResolvedRegistryEntry[],
  byPath: ReadonlyMap<string, ResolvedRegistryEntry>,
): RegistryViolation[] {
  const violations: RegistryViolation[] = [];
  const componentVariantParentIds = new Set(
    entries.flatMap((entry) => {
      const variantOf = "variantOf" in entry ? entry.variantOf : undefined;
      return entry.kind === "component" && typeof variantOf === "string"
        ? [variantOf]
        : [];
    }),
  );
  for (const entry of entries) {
    const variantOf = "variantOf" in entry ? entry.variantOf : undefined;
    if (
      (entry.kind !== "screen" && entry.kind !== "component") ||
      typeof variantOf !== "string"
    ) {
      continue;
    }
    const parent = byPath.get(variantOf);
    if (!parent) {
      violations.push(
        problem(
          entry,
          "invalid-variant-of",
          `variant parent does not exist: ${variantOf}`,
        ),
      );
      continue;
    }
    if (parent.kind !== entry.kind) {
      violations.push(
        problem(
          entry,
          "invalid-variant-of",
          `variant parent is not a ${entry.kind}: ${variantOf}`,
        ),
      );
      continue;
    }
    if ("variantOf" in parent && typeof parent.variantOf === "string") {
      violations.push(
        problem(
          entry,
          "invalid-variant-of",
          `variant parent is itself a variant: ${variantOf}`,
        ),
      );
      continue;
    }
  }
  for (const entry of entries) {
    const variantOf = "variantOf" in entry ? entry.variantOf : undefined;
    if (entry.kind !== "component" || typeof variantOf === "string") {
      continue;
    }
    if (!componentVariantParentIds.has(entry.path)) {
      violations.push(
        problem(
          entry,
          "invalid-variants",
          `component ${entry.path} requires at least one variant`,
        ),
      );
    }
  }
  return violations;
}
