import path from "node:path";

import { ComponentValidationError } from "@mokly/viewer/data";

import type {
  RegistryDefinition,
  ResolvedRegistryEntry,
} from "../authoring/types.js";
import { validateComponentDefinition } from "../components/definition.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import { problem } from "./entry_metadata.js";
import { validateEntry } from "./entry_validation.js";
import type { PreparedRegistry, RegistryViolation } from "./prepared_types.js";
import {
  crossReferenceViolations,
  duplicateViolations,
} from "./relationships.js";

/** Validate loaded values and prepare stable source-attributed entries. */
export function prepareRegistry(
  values: readonly unknown[],
  config: ResolvedConfig,
): PreparedRegistry {
  const violations: RegistryViolation[] = [];
  const entries: ResolvedRegistryEntry[] = [];
  values.forEach((value, index) => {
    if (!isDefinition(value)) {
      violations.push({
        code: "invalid-definition",
        message: `exported definition #${index + 1} is not a registry definition`,
        sourceRelativePath: toPosixPath(
          path.relative(config.repoRoot, config.entriesDir),
        ),
      });
      return;
    }
    const sourceRelativePath = value.definedIn ?? "<unattributed>";
    const sourcePath = path.resolve(config.repoRoot, sourceRelativePath);
    const entry = {
      ...value,
      sourcePath,
      sourceRelativePath,
    } as ResolvedRegistryEntry;
    const metadataViolations = validateEntry(entry, config);
    violations.push(...metadataViolations);
    if (entry.kind === "component") {
      if (metadataViolations.length) return;
      try {
        entries.push({
          ...validateComponentDefinition(entry),
          sourcePath,
          sourceRelativePath,
        });
      } catch (error) {
        if (!(error instanceof ComponentValidationError)) throw error;
        violations.push(problem(entry, "invalid-component", error.message));
      }
    } else entries.push(entry);
  });
  entries.sort(compareEntries);
  violations.push(
    ...duplicateViolations(entries, "id"),
    ...duplicateViolations(entries, "route"),
    ...crossReferenceViolations(entries),
  );
  if (entries.length === 0) {
    violations.push({
      code: "empty-registry",
      message: "no registry definitions were exported",
      sourceRelativePath: toPosixPath(
        path.relative(config.repoRoot, config.entriesDir),
      ),
    });
  }
  if (violations.length > 0) throw invalidRegistry(violations);
  return { byId: new Map(entries.map((entry) => [entry.id, entry])), entries };
}

function isDefinition(value: unknown): value is RegistryDefinition {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const kind = (value as { kind?: unknown }).kind;
  return (
    kind === "page" ||
    kind === "screen" ||
    kind === "collection" ||
    kind === "use-case" ||
    kind === "component"
  );
}

function compareEntries(
  left: ResolvedRegistryEntry,
  right: ResolvedRegistryEntry,
): number {
  const leftRoute = left.kind === "collection" ? "" : left.route;
  const rightRoute = right.kind === "collection" ? "" : right.route;
  return leftRoute < rightRoute
    ? -1
    : leftRoute > rightRoute
      ? 1
      : left.id < right.id
        ? -1
        : left.id > right.id
          ? 1
          : 0;
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
