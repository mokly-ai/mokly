/** Validate recorded resource owners and inserted stylesheet spans. */
import { isStylesheetPath } from "../review/css/stylesheet_path.js";

import { exactKeys, invalidData } from "./data.js";
import type { ComponentViewRecord } from "./manifest_types.js";
import { sortedStrings, validateResourcePath } from "./validation_helpers.js";

export function validateViewMaterials(
  view: ComponentViewRecord,
  rendered: ReadonlySet<string>,
  at: string,
): void {
  for (const resource of view.resources) {
    exactKeys(resource, ["path", "componentIds"], at);
    validateResourcePath(resource.path, at);
    if (isStylesheetPath(resource.path))
      invalidData(at, "stylesheet resources cannot have owners");
    validateOwners(resource.componentIds, rendered, at);
  }
  sortedStrings(
    view.resources.map((resource) => resource.path),
    `${at}.resources`,
  );
  if (view.insertedStylesheets !== undefined) {
    if (!Array.isArray(view.insertedStylesheets))
      invalidData(at, "insertedStylesheets must be an array");
    let previousEnd = 0;
    for (const link of view.insertedStylesheets) {
      exactKeys(
        link,
        ["startOffset", "endOffset", "path", "componentPaths"],
        at,
      );
      if (
        typeof link.startOffset !== "number" ||
        typeof link.endOffset !== "number" ||
        !Number.isSafeInteger(link.startOffset) ||
        !Number.isSafeInteger(link.endOffset) ||
        link.startOffset < previousEnd ||
        link.endOffset <= link.startOffset
      )
        invalidData(at, "invalid or overlapping inserted stylesheet span");
      validateResourcePath(link.path, at);
      validateOwners(link.componentPaths, rendered, at);
      previousEnd = link.endOffset;
    }
  }
}

function validateOwners(
  value: unknown,
  rendered: ReadonlySet<string>,
  at: string,
): void {
  sortedStrings(value, at);
  if (!value.length || !value.every((id) => rendered.has(id)))
    invalidData(at, "style/resource owners must render in this view");
}
