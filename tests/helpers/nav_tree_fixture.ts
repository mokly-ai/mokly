import assert from "node:assert/strict";

import type { ManifestV9 } from "../../packages/viewer/dist/registry/types.js";
import { createCatalogue } from "../../packages/viewer/dist/shell/catalogue.js";
import {
  buildNavSections,
  type NavGroupNode,
  type NavNode,
} from "../../packages/viewer/dist/shell/nav_tree.js";

import { currentManifest } from "./current_manifest.js";

/** A minimal current screen record, optionally a variant of `variantOf`. */
export function screen(
  id: string,
  title: string,
  variantOf?: string,
): ManifestV9["entries"][number] {
  return {
    colorSchemes: ["light"],
    description: title,
    path: id,
    kind: "screen",
    relatedDocs: [],
    sourcePath: `entries/${id}.tsx`,
    title,
    useCasePaths: [],
    ...(variantOf ? { variantOf } : {}),
  };
}

/** A minimal current page record. */
export function page(
  id: string,
  title: string,
  _route: string,
): ManifestV9["entries"][number] {
  return {
    description: title,
    path: id,
    kind: "page",

    relatedDocs: [],
    sourcePath: `entries/${id}.tsx`,
    title,
  };
}

/** The catalogue, hierarchy, Specs rows, and sections built from entries. */
export function tree(entries: ManifestV9["entries"]) {
  const manifest: ManifestV9 = currentManifest({
    entries,
    generatedBy: "mokly",
    schemaVersion: 9 as const,
    folders: [],
    sourceFiles: [
      ...new Set(entries.map(({ sourcePath }) => sourcePath)),
    ].sort(),
  });
  const catalogue = createCatalogue(manifest);
  const sections = buildNavSections(catalogue.hierarchy);
  return {
    catalogue,
    hierarchy: catalogue.hierarchy,
    nodes: sections.find(({ id }) => id === "specs")?.children ?? [],
    sections,
  };
}

/** The folder row with `key`, failing the test when it is missing. */
export function group(nodes: readonly NavNode[], key: string): NavGroupNode {
  const found = nodes.find((node) => node.kind === "group" && node.key === key);
  assert.ok(found?.kind === "group");
  return found;
}
