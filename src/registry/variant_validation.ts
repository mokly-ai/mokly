import type { ResolvedRegistryEntry } from "../authoring/types.js";
import {
  isScreenVariantRoute,
  isScreenVariantSlug,
  screenVariantAuthoring,
  screenVariantRoute,
} from "../authoring/variants.js";

import { nonEmpty, problem } from "./entry_metadata.js";
import type { RegistryViolation } from "./prepared_types.js";

/** Validate fields that can be checked on one prepared registry entry. */
export function variantEntryViolations(
  entry: ResolvedRegistryEntry,
): RegistryViolation[] {
  const violations: RegistryViolation[] = [];
  if (entry.kind !== "screen") {
    const fields =
      entry.kind === "component"
        ? (["variantOf"] as const)
        : (["variants", "variantOf"] as const);
    for (const field of fields) {
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
        "screen definitions must flatten variants before registration",
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
        "variantOf must be a non-empty screen id when supplied",
      ),
    );
  }
  if (typeof entry.variantOf !== "string") return violations;
  const authoring = screenVariantAuthoring(entry);
  for (const field of authoring?.forbiddenFields ?? []) {
    violations.push(
      problem(
        entry,
        "invalid-variants",
        `a screen variant cannot declare ${field}`,
      ),
    );
  }
  return violations;
}

/** Validate variant parents, routes, authored slugs, and inherited paths. */
export function crossReferenceVariantViolations(
  entries: readonly ResolvedRegistryEntry[],
  byId: ReadonlyMap<string, ResolvedRegistryEntry>,
): RegistryViolation[] {
  const violations: RegistryViolation[] = [];
  const seenVariantRoutes = new Set<string>();
  for (const entry of entries) {
    if (entry.kind !== "screen" || typeof entry.variantOf !== "string") {
      continue;
    }
    const parent = byId.get(entry.variantOf);
    if (!parent) {
      violations.push(
        problem(
          entry,
          "invalid-variant-of",
          `variant parent screen does not exist: ${entry.variantOf}`,
        ),
      );
      continue;
    }
    if (parent.kind !== "screen") {
      violations.push(
        problem(
          entry,
          "invalid-variant-of",
          `variant parent is not a screen: ${entry.variantOf}`,
        ),
      );
      continue;
    }
    if (typeof parent.variantOf === "string") {
      violations.push(
        problem(
          entry,
          "invalid-variant-of",
          `variant parent is itself a variant: ${entry.variantOf}`,
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
    const authoring = screenVariantAuthoring(entry);
    let validRoute: boolean;
    if (authoring) {
      const { slug } = authoring;
      if (!isScreenVariantSlug(slug)) {
        violations.push(
          problem(
            parent,
            "invalid-variants",
            `variant ${entry.id} slug must be one portable URL path segment`,
          ),
        );
        continue;
      }
      validRoute = entry.route === screenVariantRoute(parent.route, slug);
    } else {
      validRoute = isScreenVariantRoute(parent.route, entry.route);
    }
    if (!validRoute) {
      violations.push(
        problem(
          entry,
          "invalid-variant-of",
          `variant route does not match its parent screen: ${parent.id}`,
        ),
      );
    }
    const routeKey = `${parent.id}:${entry.route}`;
    if (seenVariantRoutes.has(routeKey)) {
      violations.push(
        problem(
          parent,
          "duplicate-variant-slug",
          `variants of ${parent.id} must have unique slugs and routes`,
        ),
      );
    }
    seenVariantRoutes.add(routeKey);
  }
  return violations;
}
