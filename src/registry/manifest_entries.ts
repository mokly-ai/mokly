import { isCatalogueId } from "@mokly/viewer/data";

import { validateManifestComponent } from "../components/manifest_validation.js";
import { MoklyError } from "../errors.js";

import {
  nonEmptyString,
  record,
  stringArray,
  validateRepoPath,
  validateRoute,
} from "./manifest_values.js";

/** Validate the public fields for one historical or current entry. */
export function validateEntry(
  entry: Record<string, unknown>,
  components = false,
): void {
  const kind = entry.kind;
  if (
    kind !== "collection" &&
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
  for (const field of ["navPath", "relatedDocs", "dependencies"] as const) {
    if (!stringArray(entry[field])) {
      throw new MoklyError(
        "manifest-invalid",
        `${String(entry.id)} has invalid ${field}`,
      );
    }
  }
  for (const field of ["relatedDocs", "dependencies"] as const) {
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
  if (typeof entry.route !== "string") {
    throw new MoklyError(
      "manifest-invalid",
      `${String(entry.id)} has no route`,
    );
  }
  validateRoute(entry.route, String(entry.id));
  if (entry.tags !== undefined && !stringArray(entry.tags)) {
    throw new MoklyError(
      "manifest-invalid",
      `${String(entry.id)} has invalid tags`,
    );
  }
  if (kind === "component") validateManifestComponent(entry);
  else if (kind === "screen") validateScreen(entry);
  else if (kind === "use-case") validateUseCase(entry);
}

function validateScreen(entry: Record<string, unknown>): void {
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
  if (!stringArray(entry.useCaseIds)) {
    throw new MoklyError(
      "manifest-invalid",
      `${String(entry.id)} has invalid useCaseIds`,
    );
  }
  if (
    !Array.isArray(entry.viewports) ||
    entry.viewports.length !== 2 ||
    entry.viewports[0] !== "mobile" ||
    entry.viewports[1] !== "desktop"
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
): void {
  const common = [
    "dependencies",
    "description",
    "id",
    "kind",
    "navPath",
    "rationale",
    "relatedDocs",
    "sourcePath",
    "title",
    ...(components ? ["declaredDependencies"] : []),
  ];
  const specific =
    entry.kind === "collection"
      ? ["childIds"]
      : entry.kind === "page"
        ? ["route", "tags"]
        : entry.kind === "component" && components
          ? [
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
            ? [
                "route",
                "tags",
                "address",
                "darkFragments",
                "fragments",
                "useCaseIds",
                "viewports",
                ...(components ? ["componentViews"] : []),
              ]
            : ["route", "tags", "steps"];
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
