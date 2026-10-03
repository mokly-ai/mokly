/** Generated-file and authored-closure validation for the v8 manifest envelope. */
import {
  GENERATED_DIRECTORY,
  entryRoute,
  generatedViews,
  isSafeCatalogueRoute,
} from "@mokly/viewer/data";

import { isValidGeneratedRoute } from "../build/styles/routes.js";
import { MoklyError } from "../errors.js";

import type { ManifestMetadata } from "./manifest.js";
import { record, stringArray, validateRepoPath } from "./manifest_values.js";

/** Require complete HTML inventory and safe, sorted, byte-addressed resources. */
export function validateManifestInventory(
  value: Record<string, unknown>,
  metadata: ManifestMetadata,
): void {
  const algorithm = value.blobHashAlgorithm;
  if (algorithm !== "sha1" && algorithm !== "sha256")
    failure("invalid blobHashAlgorithm");
  const closure = value.assetClosure;
  if (!stringArray(closure) || !sortedUnique(closure))
    failure("assetClosure must be a sorted unique array");
  for (const route of closure) {
    validateRepoPath(route, "assetClosure");
    if (
      route === GENERATED_DIRECTORY ||
      route.startsWith(`${GENERATED_DIRECTORY}/`)
    )
      failure("assetClosure contains generated output");
  }
  const inventory = value.generatedFiles;
  if (!Array.isArray(inventory))
    failure("generatedFiles must be sorted and unique");
  const routes: string[] = [];
  const hashes = new RegExp(`^[0-9a-f]{${algorithm === "sha1" ? 40 : 64}}$`);
  for (const item of inventory) {
    if (
      !record(item) ||
      Object.keys(item).length !== 2 ||
      typeof item.path !== "string" ||
      typeof item.blobHash !== "string"
    )
      failure("invalid generatedFiles entry");
    if (!isSafeCatalogueRoute(item.path) && !isValidGeneratedRoute(item.path))
      failure(`invalid generatedFiles.path: ${item.path}`);
    if (!hashes.test(item.blobHash))
      failure(`invalid blob hash for ${item.path}`);
    routes.push(item.path);
  }
  if (!sortedUnique(routes))
    failure("generatedFiles must be sorted and unique");
  const folded = new Set<string>();
  for (const route of routes) {
    const lower = route.toLowerCase();
    if (folded.has(lower)) failure(`generated file collision: ${route}`);
    folded.add(lower);
  }
  for (const route of routes) {
    const segments = route.toLowerCase().split("/");
    for (let i = 1; i < segments.length; i++)
      if (folded.has(segments.slice(0, i).join("/")))
        failure(`generated file collision: ${route}`);
  }
  const expected = metadata.entries
    .flatMap((entry) =>
      entry.kind === "page"
        ? [entryRoute("page", entry.id)]
        : generatedViews(entry).map((view) => view.path),
    )
    .sort();
  const actual = routes.filter((route) => route.endsWith(".html"));
  if (JSON.stringify(expected) !== JSON.stringify(actual))
    failure(
      "generatedFiles must include exactly the generated document routes",
    );
}

function sortedUnique(values: readonly string[]): boolean {
  return JSON.stringify(values) === JSON.stringify([...new Set(values)].sort());
}

function failure(message: string): never {
  throw new MoklyError("manifest-invalid", message);
}
