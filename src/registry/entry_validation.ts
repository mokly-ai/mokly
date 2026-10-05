import { isEntryPath } from "@mokly/viewer/data";

import { UNKNOWN_FIELDS } from "../authoring/markers.js";
import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { isResolvedEntryOrInventoriedSource } from "../config/entry_membership.js";
import type { ResolvedConfig } from "../config/types.js";

import {
  problem,
  validateTags,
  validatePaths,
  validateTextList,
  nonEmpty,
  validColorSchemes,
  record,
} from "./entry_metadata.js";
import type { RegistryViolation } from "./prepared_types.js";
import { variantEntryViolations } from "./variant_validation.js";

/** Validate metadata, routes, source attribution, and declared paths. */
export function validateEntry(
  entry: ResolvedRegistryEntry,
  config: ResolvedConfig,
): RegistryViolation[] {
  const violations: RegistryViolation[] = [];
  for (const field of (entry.kind === "document"
    ? []
    : entry[UNKNOWN_FIELDS]) ?? [])
    violations.push(problem(entry, "invalid-field", `unknown field ${field}`));
  for (const field of ["path", "title", "description"] as const) {
    if (
      !(entry.kind === "document" && field === "description") &&
      !nonEmpty(entry[field])
    ) {
      violations.push(
        problem(entry, "missing-metadata", `${field} is required`),
      );
    }
  }
  if (!isEntryPath(entry.path)) {
    violations.push(
      problem(entry, "invalid-path", "path must be a valid catalogue path"),
    );
  }
  if (entry.kind !== "document" && entry.__viaDefine !== true) {
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
    !isResolvedEntryOrInventoriedSource(entry.sourceRelativePath, config)
  ) {
    violations.push(
      problem(
        entry,
        "invalid-source",
        "definition is not attributed to a resolved entry module or inventoried source",
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
  validateInteractive(entry, violations);
  if (entry.kind === "page") {
    if (typeof entry.render !== "function")
      violations.push(
        problem(entry, "missing-render", "page render callback is required"),
      );
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
    validateTextList(
      entry,
      "useCasePaths",
      entry.useCasePaths,
      true,
      violations,
    );
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
      if (record(step))
        for (const field of Object.keys(step))
          if (!["screenPath", "title", "description"].includes(field))
            violations.push(
              problem(
                entry,
                "invalid-field",
                `step #${index + 1}: unknown field ${field}`,
              ),
            );
      if (!record(step) || !nonEmpty(step.screenPath)) {
        violations.push(
          problem(
            entry,
            "invalid-step",
            `step #${index + 1} needs a non-empty screenPath`,
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
  violations.push(...variantEntryViolations(entry));
  return violations;
}

function validateInteractive(
  entry: ResolvedRegistryEntry,
  violations: RegistryViolation[],
): void {
  const candidate = entry as ResolvedRegistryEntry & { interactive?: unknown };
  if (!Object.hasOwn(candidate, "interactive")) return;
  if (candidate.kind !== "screen" && candidate.kind !== "component") {
    violations.push(
      problem(
        entry,
        "invalid-interactive",
        `interactive is not supported on ${candidate.kind} entries`,
      ),
    );
    return;
  }
  if (candidate.interactive !== false)
    violations.push(
      problem(
        entry,
        "invalid-interactive",
        "interactive must be false when supplied",
      ),
    );
}
