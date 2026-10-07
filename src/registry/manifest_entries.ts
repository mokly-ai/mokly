import { isKebabCase, isEntryPath } from "@mokly/viewer/data";

import { validateManifestComponent } from "../components/manifest_entry_validation.js";
import { documentResourceRoute } from "../documents/resource_paths.js";
import { MoklyError } from "../errors.js";

import {
  nonEmptyString,
  record,
  stringArray,
  validateColorSchemes,
  validateRepoPath,
} from "./manifest_values.js";

const COMMON_FIELDS = [
  "description",
  "path",
  "kind",
  "rationale",
  "movedFrom",
  "relatedDocs",
  "sourcePath",
  "title",
] as const;

/** Validate the public fields for one path-addressed v9 entry. */
export function validateManifestEntry(
  entry: Record<string, unknown>,
  components: boolean,
): void {
  const kind = entry.kind;
  if (
    kind !== "screen" &&
    kind !== "page" &&
    kind !== "document" &&
    kind !== "use-case" &&
    kind !== "component"
  )
    failure(`invalid manifest kind for ${String(entry.path)}`);
  for (const field of ["title", "description", "sourcePath"] as const)
    if (
      typeof entry[field] !== "string" ||
      (entry[field].length === 0 &&
        !(kind === "document" && field === "description"))
    )
      failure(`${String(entry.path)} is missing ${field}`);
  validateRepoPath(
    entry.sourcePath as string,
    `${String(entry.path)} sourcePath`,
  );
  if (entry.rationale !== undefined && !nonEmptyString(entry.rationale))
    failure(`${String(entry.path)} has invalid rationale`);
  for (const field of ["relatedDocs"] as const)
    if (!stringArray(entry[field]))
      failure(`${String(entry.path)} has invalid ${field}`);
  for (const field of ["relatedDocs"] as const)
    for (const value of entry[field] as string[])
      validateRepoPath(value, `${String(entry.path)} ${field}`);
  if (entry.movedFrom !== undefined && !isEntryPath(entry.movedFrom))
    failure(`${String(entry.path)} has invalid movedFrom`);
  validateTags(entry);
  if (kind === "component") validateManifestComponent(entry);
  else if (kind === "screen") validateScreen(entry, components);
  else if (kind === "use-case") validateUseCase(entry);
  else if (kind === "document") {
    validateColorSchemes(entry.colorSchemes, String(entry.path));
    if (!stringArray(entry.resources))
      failure(`${String(entry.path)} has invalid resources`);
    if ((entry.relatedDocs as string[]).length)
      failure(`${String(entry.path)} documents cannot declare relatedDocs`);
    if (
      JSON.stringify(entry.resources) !==
      JSON.stringify([...new Set(entry.resources)].sort())
    )
      failure(`${String(entry.path)} resources must be sorted and unique`);
    for (const resource of entry.resources) {
      validateRepoPath(resource, "resources");
      if (
        !documentResourceRoute(
          {
            path: entry.path as string,
            sourcePath: entry.sourcePath as string,
          },
          resource,
        )
      )
        failure(
          `${String(entry.path)} has invalid document resource: ${resource}`,
        );
    }
  }
  validateKnownFields(entry, components);
}

function validateScreen(
  entry: Record<string, unknown>,
  components: boolean,
): void {
  validateColorSchemes(entry.colorSchemes, String(entry.path));
  if (!stringArray(entry.useCasePaths))
    failure(`${String(entry.path)} has invalid useCasePaths`);
  if (entry.address !== undefined && !nonEmptyString(entry.address))
    failure(`${String(entry.path)} has invalid address`);
  if (
    "variantOf" in entry &&
    (typeof entry.variantOf !== "string" || !isEntryPath(entry.variantOf))
  )
    failure(`${String(entry.path)} has invalid variantOf`);
  if (!components && entry.componentViews !== undefined)
    failure(`${String(entry.path)} has component usage without components`);
}

function validateUseCase(entry: Record<string, unknown>): void {
  if (!Array.isArray(entry.steps) || entry.steps.length === 0)
    failure(`${String(entry.path)} has invalid steps`);
  for (const [index, step] of entry.steps.entries()) {
    if (!record(step) || !nonEmptyString(step.screenPath))
      failure(
        `${String(entry.path)} step #${index + 1} has invalid screenPath`,
      );
    for (const field of Object.keys(step))
      if (!["screenPath", "title", "description"].includes(field))
        failure(
          `${String(entry.path)} step #${index + 1} has unsupported ${field}`,
        );
    for (const field of ["title", "description"] as const)
      if (step[field] !== undefined && !nonEmptyString(step[field]))
        failure(
          `${String(entry.path)} step #${index + 1} has invalid ${field}`,
        );
  }
}

function validateKnownFields(
  entry: Record<string, unknown>,
  components: boolean,
): void {
  if (entry.kind === "component") return;
  const specific =
    entry.kind === "document"
      ? ["tags", "colorSchemes", "resources"]
      : entry.kind === "page"
        ? ["tags"]
        : entry.kind === "screen"
          ? [
              "tags",
              "address",
              "colorSchemes",
              "useCasePaths",
              "variantOf",
              ...(components ? ["componentViews"] : []),
            ]
          : ["tags", "steps"];
  for (const field of Object.keys(entry))
    if (![...COMMON_FIELDS, ...specific].includes(field as never))
      failure(`${String(entry.path)} has unsupported ${field}`);
}

function validateTags(entry: Record<string, unknown>): void {
  if (
    entry.tags !== undefined &&
    (!Array.isArray(entry.tags) ||
      !entry.tags.every(isKebabCase) ||
      new Set(entry.tags).size !== entry.tags.length)
  )
    failure(`${String(entry.path)} has invalid tags`);
}

function failure(message: string): never {
  throw new MoklyError("manifest-invalid", message);
}
