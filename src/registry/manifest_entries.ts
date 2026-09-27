import { isCatalogueId } from "@mokly/viewer/data";

import { validateManifestComponent } from "../components/manifest_entry_validation.js";
import { MoklyError } from "../errors.js";

import {
  nonEmptyString,
  record,
  stringArray,
  validateColorSchemes,
  validateRepoPath,
  validateRoute,
} from "./manifest_values.js";

/** Validate the public fields for one historical or current entry. */
export function validateEntry(
  entry: Record<string, unknown>,
  components = false,
  historicalCollection = false,
  identityOnly = false,
): void {
  const kind = entry.kind;
  if (
    !(historicalCollection && kind === "collection") &&
    kind !== "screen" &&
    kind !== "page" &&
    kind !== "use-case" &&
    !(components && kind === "component")
  ) {
    throw new MoklyError(
      "manifest-invalid",
      `invalid manifest kind for ${String(entry.id)}`,
    );
  }
  for (const field of ["title", "description", "sourcePath"] as const) {
    if (typeof entry[field] !== "string" || entry[field].length === 0) {
      throw new MoklyError(
        "manifest-invalid",
        `${String(entry.id)} is missing ${field}`,
      );
    }
  }
  validateRepoPath(
    entry.sourcePath as string,
    `${String(entry.id)} sourcePath`,
  );
  if (entry.rationale !== undefined && !nonEmptyString(entry.rationale)) {
    throw new MoklyError(
      "manifest-invalid",
      `${String(entry.id)} has invalid rationale`,
    );
  }
  const arrayFields = [
    "navPath",
    "relatedDocs",
    identityOnly ? "declaredDependencies" : "dependencies",
  ] as const;
  for (const field of arrayFields) {
    if (!stringArray(entry[field])) {
      throw new MoklyError(
        "manifest-invalid",
        `${String(entry.id)} has invalid ${field}`,
      );
    }
  }
  for (const field of [
    "relatedDocs",
    identityOnly ? "declaredDependencies" : "dependencies",
  ] as const) {
    for (const value of entry[field] as string[]) {
      validateRepoPath(value, `${String(entry.id)} ${field}`);
    }
  }
  if (kind === "collection") {
    if (!stringArray(entry.childIds)) {
      throw new MoklyError(
        "manifest-invalid",
        `${String(entry.id)} has invalid childIds`,
      );
    }
    return;
  }
  if (!identityOnly) {
    if (typeof entry.route !== "string") {
      throw new MoklyError(
        "manifest-invalid",
        `${String(entry.id)} has no route`,
      );
    }
    validateRoute(entry.route, String(entry.id));
  }
  if (entry.tags !== undefined && !stringArray(entry.tags)) {
    throw new MoklyError(
      "manifest-invalid",
      `${String(entry.id)} has invalid tags`,
    );
  }
  if (kind === "component") validateManifestComponent(entry, identityOnly);
  else if (kind === "screen") validateScreen(entry, identityOnly);
  else if (kind === "use-case") validateUseCase(entry);
}

function validateScreen(
  entry: Record<string, unknown>,
  identityOnly: boolean,
): void {
  if (identityOnly) {
    validateColorSchemes(entry.colorSchemes, String(entry.id));
    validateScreenMetadata(entry, false);
    return;
  }
  if (!record(entry.fragments)) {
    throw new MoklyError(
      "manifest-invalid",
      `${String(entry.id)} has no fragments`,
    );
  }
  for (const viewport of ["mobile", "desktop"] as const) {
    const fragment = entry.fragments[viewport];
    if (typeof fragment !== "string") {
      throw new MoklyError(
        "manifest-invalid",
        `${String(entry.id)} has no ${viewport} fragment`,
      );
    }
    validateRoute(fragment, `${String(entry.id)} ${viewport} fragment`);
  }
  if (entry.darkFragments !== undefined) {
    if (!record(entry.darkFragments)) {
      throw new MoklyError(
        "manifest-invalid",
        `${String(entry.id)} has invalid darkFragments`,
      );
    }
    for (const viewport of ["mobile", "desktop"] as const) {
      const fragment = entry.darkFragments[viewport];
      if (typeof fragment !== "string") {
        throw new MoklyError(
          "manifest-invalid",
          `${String(entry.id)} has no ${viewport} dark fragment`,
        );
      }
      validateRoute(fragment, `${String(entry.id)} ${viewport} dark fragment`);
    }
  }
  validateScreenMetadata(entry, true);
}

function validateScreenMetadata(
  entry: Record<string, unknown>,
  requireViewports: boolean,
): void {
  if (!stringArray(entry.useCaseIds)) {
    throw new MoklyError(
      "manifest-invalid",
      `${String(entry.id)} has invalid useCaseIds`,
    );
  }
  if (
    requireViewports &&
    (!Array.isArray(entry.viewports) ||
      entry.viewports.length !== 2 ||
      entry.viewports[0] !== "mobile" ||
      entry.viewports[1] !== "desktop")
  ) {
    throw new MoklyError(
      "manifest-invalid",
      `${String(entry.id)} has invalid viewports`,
    );
  }
  if (entry.address !== undefined && !nonEmptyString(entry.address)) {
    throw new MoklyError(
      "manifest-invalid",
      `${String(entry.id)} has invalid address`,
    );
  }
  if (
    "variantOf" in entry &&
    (typeof entry.variantOf !== "string" || !isCatalogueId(entry.variantOf))
  ) {
    throw new MoklyError(
      "manifest-invalid",
      `${String(entry.id)} has invalid variantOf`,
    );
  }
}

function validateUseCase(entry: Record<string, unknown>): void {
  if (!Array.isArray(entry.steps) || entry.steps.length === 0) {
    throw new MoklyError(
      "manifest-invalid",
      `${String(entry.id)} has invalid steps`,
    );
  }
  for (const [index, step] of entry.steps.entries()) {
    if (!record(step) || !nonEmptyString(step.screenId)) {
      throw new MoklyError(
        "manifest-invalid",
        `${String(entry.id)} step #${index + 1} has invalid screenId`,
      );
    }
    for (const field of ["title", "description"] as const) {
      if (step[field] !== undefined && !nonEmptyString(step[field])) {
        throw new MoklyError(
          "manifest-invalid",
          `${String(entry.id)} step #${index + 1} has invalid ${field}`,
        );
      }
    }
  }
}

/** Reject fields outside the source-inventoried entry contract. */
export function validateCurrentFields(
  entry: Record<string, unknown>,
  components = false,
  historicalCollection = false,
  current = false,
): void {
  const common = [
    "description",
    "id",
    "kind",
    "navPath",
    "rationale",
    "relatedDocs",
    "sourcePath",
    "title",
    ...(current ? ["declaredDependencies"] : ["dependencies"]),
    ...(!current && components ? ["declaredDependencies"] : []),
  ];
  const specific =
    entry.kind === "collection" && historicalCollection
      ? ["childIds"]
      : entry.kind === "page"
        ? [...(current ? [] : ["route"]), "tags"]
        : entry.kind === "component" && components
          ? typeof entry.variantOf === "string"
            ? current
              ? [
                  "colorSchemes",
                  "tags",
                  "variantOf",
                  "props",
                  "suppliedSlots",
                  "componentViews",
                ]
              : [
                  "route",
                  "tags",
                  "viewports",
                  "variantOf",
                  "props",
                  "suppliedSlots",
                  "fragments",
                  "darkFragments",
                  "componentViews",
                ]
            : current
              ? [
                  "colorSchemes",
                  "tags",
                  "propSchema",
                  "slots",
                  "controls",
                  "ownedDependencies",
                ]
              : [
                  "route",
                  "tags",
                  "viewports",
                  "propSchema",
                  "slots",
                  "controls",
                  "ownedDependencies",
                  "variants",
                ]
          : entry.kind === "screen"
            ? current
              ? [
                  "tags",
                  "address",
                  "colorSchemes",
                  "useCaseIds",
                  "variantOf",
                  ...(components ? ["componentViews"] : []),
                ]
              : [
                  "route",
                  "tags",
                  "address",
                  "darkFragments",
                  "fragments",
                  "useCaseIds",
                  "variantOf",
                  "viewports",
                  ...(components ? ["componentViews"] : []),
                ]
            : [...(current ? [] : ["route"]), "tags", "steps"];
  for (const field of Object.keys(entry))
    if (![...common, ...specific].includes(field))
      throw new MoklyError(
        "manifest-invalid",
        `${String(entry.id)} has unsupported ${field}`,
      );
  if (
    entry.tags !== undefined &&
    (!Array.isArray(entry.tags) ||
      !entry.tags.every(isCatalogueId) ||
      new Set(entry.tags).size !== entry.tags.length)
  )
    throw new MoklyError(
      "manifest-invalid",
      `${String(entry.id)} has invalid tags`,
    );
}
