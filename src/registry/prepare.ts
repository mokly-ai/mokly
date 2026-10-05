import { ComponentValidationError } from "@mokly/viewer/data";
import { resolveLinkPath } from "@mokly/viewer/data";

import { existingDefinitionReference } from "../authoring/identity.js";
import type { ResolvedRegistryEntry } from "../authoring/types.js";
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
import type { ResolvedConfig } from "../config/types.js";
import type { ResolvedDocument } from "../documents/load.js";
import { MoklyError } from "../errors.js";

import { problem } from "./entry_metadata.js";
import { orderEntriesWithVariants } from "./entry_order.js";
import { validateEntry } from "./entry_validation.js";
import { folderViolations } from "./folder_validation.js";
import { moveHintDiagnostics } from "./move_hints.js";
import { pathCollisions } from "./path_collisions.js";
import type { PreparedRegistry, RegistryViolation } from "./prepared_types.js";
import { crossReferenceViolations } from "./relationships.js";
import { resolveDefinitions } from "./resolve_definitions.js";

/**
 * Validate loaded values and prepare stable source-attributed entries. Valid
 * sibling variants follow their parent in authored order; a variant without a
 * uniquely valid root-screen parent stays in kind/id order for validation.
 */
export function prepareRegistry(
  values: readonly unknown[],
  config: ResolvedConfig,
  documents: readonly ResolvedDocument[] = [],
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
  const resolved = resolveDefinitions(values, config, warn);
  for (const diagnostic of resolved.diagnostics)
    violations.push({ ...diagnostic, sourceRelativePath: "" });
  for (const entry of [...resolved.entries, ...documents]) {
    const { sourcePath, sourceRelativePath } = entry;
    if (entry.kind === "screen" && Array.isArray(entry.useCasePaths))
      entry.useCasePaths = entry.useCasePaths.map((target) =>
        typeof target === "string"
          ? (resolveLinkPath(target, entry.linkBase) ?? target)
          : target,
      );
    if (entry.kind === "use-case" && Array.isArray(entry.steps))
      entry.steps = entry.steps.map((step) =>
        step && typeof step.screenPath === "string"
          ? {
              ...step,
              screenPath:
                resolveLinkPath(step.screenPath, entry.linkBase) ??
                step.screenPath,
            }
          : step,
      );
    if (Object.hasOwn(entry, "dependencies"))
      warn(removedDependencies(entry.path));
    if (entry.kind === "component" && Object.hasOwn(entry, "ownedDependencies"))
      warn(removedOwnedDependencies(entry.path));
    Reflect.deleteProperty(entry, "dependencies");
    Reflect.deleteProperty(entry, "ownedDependencies");
    const metadataViolations = validateEntry(entry, config);
    violations.push(...metadataViolations);
    if (entry.kind === "component" && !("variantOf" in entry)) {
      if (metadataViolations.length) {
        entries.push(entry);
        continue;
      }
      try {
        const definition = {
          ...validateComponentDefinition(entry),
          sourcePath,
          sourceRelativePath,
          path: entry.path,
          slug: entry.slug,
          index: entry.index,
          linkBase: entry.linkBase,
          location: entry.location,
        };
        entries.push(definition);
        validComponentParents.add(definition);
      } catch (error) {
        if (!(error instanceof ComponentValidationError)) throw error;
        entries.push(entry);
        violations.push(problem(entry, "invalid-component", error.message));
      }
    } else entries.push(entry);
  }
  validateComponentVariants(entries, validComponentParents, violations);
  const orderedEntries = orderEntriesWithVariants(entries, (entry) => entry);
  violations.push(
    ...moveHintDiagnostics(orderedEntries).map((diagnostic) => ({
      ...diagnostic,
      sourceRelativePath: "",
    })),
    ...pathCollisions(orderedEntries).map((diagnostic) => ({
      ...diagnostic,
      sourceRelativePath: "",
    })),
    ...folderViolations(resolved.folders, orderedEntries),
    ...crossReferenceViolations(orderedEntries),
  );
  if (entries.length === 0 && violations.length === 0) {
    violations.push({
      code: "empty-registry",
      message: "no registry definitions were exported",
      sourceRelativePath: "",
    });
  }
  if (violations.length > 0) throw invalidRegistry(violations);
  validateDeclaredStylesheets(orderedEntries, config, warn);
  return {
    folders: resolved.folders,
    references: new Map(
      orderedEntries.flatMap((entry) => {
        const reference =
          entry.kind === "document"
            ? undefined
            : existingDefinitionReference(entry);
        return reference ? [[reference, entry.path] as const] : [];
      }),
    ),
    byPath: new Map(orderedEntries.map((entry) => [entry.path, entry])),
    entries: orderedEntries,
    warnings,
  };
}

function validateComponentVariants(
  entries: ResolvedRegistryEntry[],
  validParents: ReadonlySet<ResolvedRegistryEntry>,
  violations: RegistryViolation[],
): void {
  const byPath = new Map<string, ResolvedRegistryEntry[]>();
  for (const entry of entries)
    byPath.set(entry.path, [...(byPath.get(entry.path) ?? []), entry]);
  for (const [index, entry] of entries.entries()) {
    if (entry.kind !== "component" || !("variantOf" in entry)) continue;
    if (typeof entry.variantOf !== "string") continue;
    const candidates = byPath.get(entry.variantOf) ?? [];
    const parent = candidates.length === 1 ? candidates[0] : undefined;
    if (!parent || parent.kind !== "component" || "variantOf" in parent)
      continue;
    for (const field of ["relatedDocs", "colorSchemes", "tags"] as const) {
      if (JSON.stringify(entry[field]) !== JSON.stringify(parent[field])) {
        violations.push(
          problem(
            entry,
            "invalid-variants",
            `component variant ${entry.path} must inherit ${field} from ${parent.path}`,
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
        path: entry.path,
        slug: entry.slug,
        index: entry.index,
        linkBase: entry.linkBase,
        location: entry.location,
      };
    } catch (error) {
      if (!(error instanceof ComponentValidationError)) throw error;
      violations.push(problem(entry, "invalid-component", error.message));
    }
  }
}

function invalidRegistry(violations: readonly RegistryViolation[]): MoklyError {
  const ordered = [...violations].sort((left, right) =>
    `${left.code}:${left.sourceRelativePath}:${left.message}`.localeCompare(
      `${right.code}:${right.sourceRelativePath}:${right.message}`,
    ),
  );
  return new MoklyError(
    "build-invalid",
    `catalogue is invalid:\n${ordered.map((item) => `- [${item.code}] ${item.sourceRelativePath ? `${item.sourceRelativePath}${item.path ? ` (${item.path})` : ""}: ` : ""}${item.message}`).join("\n")}`,
  );
}
