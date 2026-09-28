import { isCatalogueId } from "@mokly/viewer/data";

import { validateManifestComponent } from "../components/manifest_entry_validation.js";
import { MoklyError } from "../errors.js";

import {
  nonEmptyString,
  record,
  stringArray,
  validateColorSchemes,
  validateRepoPath,
} from "./manifest_values.js";

const COMMON_FIELDS = [
  "declaredDependencies",
  "description",
  "id",
  "kind",
  "navPath",
  "rationale",
  "relatedDocs",
  "sourcePath",
  "title",
] as const;

/** Validate the public fields for one identity-only v7 entry. */
export function validateManifestEntry(
  entry: Record<string, unknown>,
  components: boolean,
): void {
  const kind = entry.kind;
  if (
    kind !== "screen" &&
    kind !== "page" &&
    kind !== "use-case" &&
    kind !== "component"
  )
    failure(`invalid manifest kind for ${String(entry.id)}`);
  for (const field of ["title", "description", "sourcePath"] as const)
    if (typeof entry[field] !== "string" || entry[field].length === 0)
      failure(`${String(entry.id)} is missing ${field}`);
  validateRepoPath(
    entry.sourcePath as string,
    `${String(entry.id)} sourcePath`,
  );
  if (entry.rationale !== undefined && !nonEmptyString(entry.rationale))
    failure(`${String(entry.id)} has invalid rationale`);
  for (const field of [
    "navPath",
    "relatedDocs",
    "declaredDependencies",
  ] as const)
    if (!stringArray(entry[field]))
      failure(`${String(entry.id)} has invalid ${field}`);
  for (const field of ["relatedDocs", "declaredDependencies"] as const)
    for (const value of entry[field] as string[])
      validateRepoPath(value, `${String(entry.id)} ${field}`);
  validateTags(entry);
  if (kind === "component") validateManifestComponent(entry);
  else if (kind === "screen") validateScreen(entry, components);
  else if (kind === "use-case") validateUseCase(entry);
  validateKnownFields(entry, components);
}

function validateScreen(
  entry: Record<string, unknown>,
  components: boolean,
): void {
  validateColorSchemes(entry.colorSchemes, String(entry.id));
  if (!stringArray(entry.useCaseIds))
    failure(`${String(entry.id)} has invalid useCaseIds`);
  if (entry.address !== undefined && !nonEmptyString(entry.address))
    failure(`${String(entry.id)} has invalid address`);
  if (
    "variantOf" in entry &&
    (typeof entry.variantOf !== "string" || !isCatalogueId(entry.variantOf))
  )
    failure(`${String(entry.id)} has invalid variantOf`);
  if (!components && entry.componentViews !== undefined)
    failure(`${String(entry.id)} has component usage without components`);
}

function validateUseCase(entry: Record<string, unknown>): void {
  if (!Array.isArray(entry.steps) || entry.steps.length === 0)
    failure(`${String(entry.id)} has invalid steps`);
  for (const [index, step] of entry.steps.entries()) {
    if (!record(step) || !nonEmptyString(step.screenId))
      failure(`${String(entry.id)} step #${index + 1} has invalid screenId`);
    for (const field of ["title", "description"] as const)
      if (step[field] !== undefined && !nonEmptyString(step[field]))
        failure(`${String(entry.id)} step #${index + 1} has invalid ${field}`);
  }
}

function validateKnownFields(
  entry: Record<string, unknown>,
  components: boolean,
): void {
  if (entry.kind === "component") return;
  const specific =
    entry.kind === "page"
      ? ["tags"]
      : entry.kind === "screen"
        ? [
            "tags",
            "address",
            "colorSchemes",
            "useCaseIds",
            "variantOf",
            ...(components ? ["componentViews"] : []),
          ]
        : ["tags", "steps"];
  for (const field of Object.keys(entry))
    if (![...COMMON_FIELDS, ...specific].includes(field as never))
      failure(`${String(entry.id)} has unsupported ${field}`);
}

function validateTags(entry: Record<string, unknown>): void {
  if (
    entry.tags !== undefined &&
    (!Array.isArray(entry.tags) ||
      !entry.tags.every(isCatalogueId) ||
      new Set(entry.tags).size !== entry.tags.length)
  )
    failure(`${String(entry.id)} has invalid tags`);
}

function failure(message: string): never {
  throw new MoklyError("manifest-invalid", message);
}
