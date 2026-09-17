import { isCatalogueId } from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { isInside } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";

import {
  problem,
  validateRoute,
  validateTags,
  validatePaths,
  validateTextList,
  nonEmpty,
  validColorSchemes,
  record,
} from "./entry_metadata.js";
import type { RegistryViolation } from "./prepared_types.js";

/** Validate metadata, routes, source attribution, and declared paths. */
export function validateEntry(
  entry: ResolvedRegistryEntry,
  config: ResolvedConfig,
): RegistryViolation[] {
  const violations: RegistryViolation[] = [];
  for (const field of ["id", "title", "description"] as const) {
    if (!nonEmpty(entry[field])) {
      violations.push(
        problem(entry, "missing-metadata", `${field} is required`),
      );
    }
  }
  if (!isCatalogueId(entry.id)) {
    violations.push(
      problem(entry, "invalid-id", "id must be globally unique kebab-case"),
    );
  }
  if (entry.__viaDefine !== true) {
    violations.push(
      problem(
        entry,
        "missing-helper",
        "entry must be created with a define helper",
      ),
    );
  }
  if (
    entry.sourceRelativePath === "<unattributed>" ||
    !isInside(config.entriesDir, entry.sourcePath)
  ) {
    violations.push(
      problem(
        entry,
        "invalid-source",
        "definition is not attributed to entriesDir",
      ),
    );
  }
  validatePaths(entry, "relatedDocs", entry.relatedDocs, config, violations);
  validatePaths(entry, "dependencies", entry.dependencies, config, violations);
  if (entry.rationale !== undefined && !nonEmpty(entry.rationale)) {
    violations.push(
      problem(
        entry,
        "invalid-metadata",
        "rationale must be non-empty when supplied",
      ),
    );
  }
  validateTags(entry, violations);
  if (entry.kind === "collection") {
    validateTextList(entry, "childIds", entry.childIds, false, violations);
  } else {
    validateRoute(entry, violations);
  }
  if (entry.kind === "page") {
    if (typeof entry.render !== "function")
      violations.push(
        problem(entry, "missing-render", "page render callback is required"),
      );
    for (const field of [
      "mobile",
      "desktop",
      "colorSchemes",
      "address",
      "useCaseIds",
      "steps",
      "childIds",
      "viewports",
      "fragments",
      "darkFragments",
    ]) {
      if (field in entry)
        violations.push(
          problem(entry, "invalid-page-field", `pages do not support ${field}`),
        );
    }
  }
  if (entry.kind === "screen" || entry.kind === "component") {
    if (entry.colorSchemes !== undefined) {
      const validSchemes = validColorSchemes(entry.colorSchemes);
      if (!validSchemes) {
        violations.push(
          problem(
            entry,
            "invalid-color-schemes",
            'colorSchemes must be a non-empty subset of ["light", "dark"] that includes "light"',
          ),
        );
      } else if (
        entry.colorSchemes.includes("dark") &&
        !config.colorSchemes.includes("dark")
      ) {
        violations.push(
          problem(
            entry,
            "unsupported-color-scheme",
            'screen declares "dark" but config colorSchemes is light-only',
          ),
        );
      }
    }
  }
  if (entry.kind === "screen") {
    if (entry.mobile === null || entry.mobile === undefined) {
      violations.push(
        problem(entry, "missing-render", "mobile render is required"),
      );
    }
    if (entry.desktop === null || entry.desktop === undefined) {
      violations.push(
        problem(entry, "missing-render", "desktop render is required"),
      );
    }
    validateTextList(entry, "useCaseIds", entry.useCaseIds, true, violations);
  }
  if (
    entry.kind === "use-case" &&
    (!Array.isArray(entry.steps) || entry.steps.length === 0)
  ) {
    violations.push(
      problem(entry, "missing-step", "use case needs at least one screen step"),
    );
  } else if (entry.kind === "use-case") {
    for (const [index, step] of entry.steps.entries()) {
      if (!record(step) || !nonEmpty(step.screenId)) {
        violations.push(
          problem(
            entry,
            "invalid-step",
            `step #${index + 1} needs a non-empty screenId`,
          ),
        );
        continue;
      }
      for (const field of ["title", "description"] as const) {
        if (step[field] !== undefined && !nonEmpty(step[field])) {
          violations.push(
            problem(
              entry,
              "invalid-step",
              `step #${index + 1} ${field} must be non-empty when supplied`,
            ),
          );
        }
      }
    }
  }
  return violations;
}
