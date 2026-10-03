import path from "node:path";

import { ComponentValidationError } from "@mokly/viewer/data";

import type {
  RegistryDefinition,
  ResolvedRegistryEntry,
} from "../authoring/types.js";
import { authoringWarnings } from "../authoring/warnings.js";
import {
  removedDependencies,
  removedOwnedDependencies,
  type BuildWarning,
} from "../build/warnings.js";
import {
  validateComponentDefinition,
  validateComponentVariantDefinition,
} from "../components/definition.js";
import { validateDeclaredStylesheets } from "../components/stylesheet_validation.js";
import type {
  ComponentDefinition,
  ComponentVariantDefinition,
} from "../components/types.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import { problem } from "./entry_metadata.js";
import { orderEntriesWithVariants } from "./entry_order.js";
import { validateEntry } from "./entry_validation.js";
import type { PreparedRegistry, RegistryViolation } from "./prepared_types.js";
import {
  crossReferenceViolations,
  duplicateViolations,
} from "./relationships.js";

/**
 * Validate loaded values and prepare stable source-attributed entries. Valid
 * sibling variants follow their parent in authored order; a variant without a
 * uniquely valid root-screen parent stays in kind/id order for validation.
 */
export function prepareRegistry(
  values: readonly unknown[],
  config: ResolvedConfig,
  onWarning?: (warning: BuildWarning) => void,
): PreparedRegistry {
  const violations: RegistryViolation[] = [];
  const entries: ResolvedRegistryEntry[] = [];
  const warnings: BuildWarning[] = [];
  const warn = (warning: BuildWarning) => {
    warnings.push(warning);
    onWarning?.(warning);
  };
  const validComponentParents = new Set<ResolvedRegistryEntry>();
  const flattened = values.flatMap((value) =>
    Array.isArray(value) ? value : [value],
  );
  flattened.forEach((value, index) => {
    if (value && typeof value === "object")
      authoringWarnings(value).forEach(warn);
    if (!isDefinition(value)) {
      violations.push({
        code: "invalid-definition",
        message: `exported definition #${index + 1} is not a registry definition`,
        sourceRelativePath: entryGlobLabel(config),
      });
      return;
    }
    const sourceRelativePath = value.definedIn ?? "<unattributed>";
    const sourcePath = path.resolve(config.repoRoot, sourceRelativePath);
    const entry = {
      ...value,
      sourcePath,
      sourceRelativePath,
    } as ResolvedRegistryEntry & {
      dependencies?: unknown;
      ownedDependencies?: unknown;
    };
    if (Object.hasOwn(entry, "dependencies"))
      warn(removedDependencies(String(entry.id)));
    if (entry.kind === "component" && Object.hasOwn(entry, "ownedDependencies"))
      warn(removedOwnedDependencies(String(entry.id)));
    delete entry.dependencies;
    delete entry.ownedDependencies;
    const metadataViolations = validateEntry(entry, config);
    violations.push(...metadataViolations);
    if (entry.kind === "component" && !("variantOf" in entry)) {
      if (metadataViolations.length) {
        entries.push(entry);
        return;
      }
      try {
        const definition = {
          ...validateComponentDefinition(entry),
          sourcePath,
          sourceRelativePath,
        };
        entries.push(definition);
        validComponentParents.add(definition);
      } catch (error) {
        if (!(error instanceof ComponentValidationError)) throw error;
        entries.push(entry);
        violations.push(problem(entry, "invalid-component", error.message));
      }
    } else entries.push(entry);
  });
  validateComponentVariants(entries, validComponentParents, violations);
  const orderedEntries = orderEntriesWithVariants(entries, (entry) => entry);
  violations.push(
    ...duplicateViolations(orderedEntries, "id"),
    ...crossReferenceViolations(orderedEntries),
  );
  if (entries.length === 0) {
    violations.push({
      code: "empty-registry",
      message: "no registry definitions were exported",
      sourceRelativePath: entryGlobLabel(config),
    });
  }
  if (violations.length > 0) throw invalidRegistry(violations);
  validateDeclaredStylesheets(orderedEntries, config, warn);
  return {
    byId: new Map(orderedEntries.map((entry) => [entry.id, entry])),
    entries: orderedEntries,
    warnings,
  };
}

function validateComponentVariants(
  entries: ResolvedRegistryEntry[],
  validParents: ReadonlySet<ResolvedRegistryEntry>,
  violations: RegistryViolation[],
): void {
  const byId = new Map<string, ResolvedRegistryEntry[]>();
  for (const entry of entries)
    byId.set(entry.id, [...(byId.get(entry.id) ?? []), entry]);
  for (const [index, entry] of entries.entries()) {
    if (entry.kind !== "component" || !("variantOf" in entry)) continue;
    if (typeof entry.variantOf !== "string") continue;
    const candidates = byId.get(entry.variantOf) ?? [];
    const parent = candidates.length === 1 ? candidates[0] : undefined;
    if (!parent || parent.kind !== "component" || "variantOf" in parent)
      continue;
    for (const field of ["relatedDocs", "colorSchemes", "tags"] as const) {
      if (JSON.stringify(entry[field]) !== JSON.stringify(parent[field])) {
        violations.push(
          problem(
            entry,
            "invalid-variants",
            `component variant ${entry.id} must inherit ${field} from ${parent.id}`,
          ),
        );
      }
    }
    if (!validParents.has(parent)) continue;
    try {
      entries[index] = {
        ...validateComponentVariantDefinition(
          entry as ComponentVariantDefinition,
          parent as ComponentDefinition,
        ),
        sourcePath: entry.sourcePath,
        sourceRelativePath: entry.sourceRelativePath,
      };
    } catch (error) {
      if (!(error instanceof ComponentValidationError)) throw error;
      violations.push(problem(entry, "invalid-component", error.message));
    }
  }
}

/** Label registry-wide violations with the configured entry globs. */
function entryGlobLabel(config: ResolvedConfig): string {
  return config.entriesDir
    ? toPosixPath(path.relative(config.repoRoot, config.entriesDir))
    : config.entryGlobs.join(", ");
}

function isDefinition(value: unknown): value is RegistryDefinition {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const kind = (value as { kind?: unknown }).kind;
  return (
    kind === "page" ||
    kind === "screen" ||
    kind === "use-case" ||
    kind === "component"
  );
}

function invalidRegistry(violations: readonly RegistryViolation[]): MoklyError {
  const ordered = [...violations].sort((left, right) =>
    `${left.code}:${left.sourceRelativePath}:${left.message}`.localeCompare(
      `${right.code}:${right.sourceRelativePath}:${right.message}`,
    ),
  );
  return new MoklyError(
    "build-invalid",
    `catalogue is invalid:\n${ordered.map((item) => `- [${item.code}] ${item.sourceRelativePath}${item.id ? ` (${item.id})` : ""}: ${item.message}`).join("\n")}`,
  );
}
