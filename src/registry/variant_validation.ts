import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { screenVariantAuthoring } from "../authoring/variants.js";

import { nonEmpty, problem } from "./entry_metadata.js";
import type { RegistryViolation } from "./prepared_types.js";

/** Validate fields that can be checked on one prepared registry entry. */
export function variantEntryViolations(
  entry: ResolvedRegistryEntry,
): RegistryViolation[] {
  const violations: RegistryViolation[] = [];
  if (entry.kind !== "screen" && entry.kind !== "component") {
    for (const field of ["variants", "variantOf"] as const) {
      if (field in entry) {
        violations.push(
          problem(
            entry,
            "invalid-variants",
            `${entry.kind} entries do not support ${field}`,
          ),
        );
      }
    }
    return violations;
  }
  if ("variants" in entry) {
    violations.push(
      problem(
        entry,
        "invalid-variants",
        `${entry.kind} definitions must flatten variants before registration`,
      ),
    );
  }
  if (
    "variantOf" in entry &&
    (typeof entry.variantOf !== "string" || !nonEmpty(entry.variantOf))
  ) {
    violations.push(
      problem(
        entry,
        "invalid-variant-of",
        "variantOf must be a non-empty parent id when supplied",
      ),
    );
  }
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
  byId: ReadonlyMap<string, ResolvedRegistryEntry>,
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
    const parent = byId.get(variantOf);
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
    if (JSON.stringify(entry.navPath) !== JSON.stringify(parent.navPath)) {
      violations.push(
        problem(
          entry,
          "invalid-variants",
          `variant ${entry.id} navPath must equal parent ${parent.id} navPath`,
        ),
      );
    }
  }
  for (const entry of entries) {
    const variantOf = "variantOf" in entry ? entry.variantOf : undefined;
    if (entry.kind !== "component" || typeof variantOf === "string") {
      continue;
    }
    if (!componentVariantParentIds.has(entry.id)) {
      violations.push(
        problem(
          entry,
          "invalid-variants",
          `component ${entry.id} requires at least one variant`,
        ),
      );
    }
  }
  return violations;
}
