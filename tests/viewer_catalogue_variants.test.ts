import assert from "node:assert/strict";
import test from "node:test";

import { projectCatalogue } from "../dist/catalogue/projection.js";
import type { ManifestScreen } from "../packages/viewer/dist/registry/types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import {
  buildNavSections,
  type NavLeafNode,
  type NavNode,
} from "../packages/viewer/dist/shell/nav_tree.js";
import { viewerCatalogue } from "../packages/viewer/dist/viewer/projection.js";

test("viewer rebuilds current and removed screen variant relationships", () => {
  const parent = screen("welcome", "welcome/index.html");
  const current = screen(
    "welcome/empty",
    "welcome/empty/index.html",
    parent.path,
  );
  const removed = screen(
    "welcome-error",
    "welcome-error/index.html",
    parent.path,
  );
  const manifest = {
    entries: [parent, current],
    generatedBy: "mokly" as const,
    schemaVersion: 8 as const,
    folders: [],
    sourceFiles: [parent.sourcePath, current.sourcePath].sort(),
  };
  const model = projectCatalogue({
    catalogue: createCatalogue(manifest, [
      { folderTitles: [], entry: removed },
    ]),
    changesStatus: "ready",
    changedEntries: [current.path],
    comparisonUrl: null,
    configPath: "mokly.config.ts",
    revision: { content: 0, evidence: 1 },
  });

  const catalogue = viewerCatalogue(model);
  assert.deepEqual(
    catalogue.hierarchy.variantsByPath
      .get(parent.path)
      ?.map(({ path }) => path),
    [current.path],
  );
  assert.equal(
    catalogue.hierarchy.variantParentByPath.get(current.path)?.path,
    parent.path,
  );
  const removedEntry = catalogue.removedEntries[0]?.entry;
  assert.equal(
    removedEntry?.kind === "screen" ? removedEntry.variantOf : undefined,
    parent.path,
  );

  const removedLeaves = catalogue.removedEntries.map(
    ({ entry }): NavLeafNode => ({
      entryId: entry.path,
      entryKind: entry.kind,
      key: `removed:${entry.path}`,
      kind: "leaf",
      label: `${entry.title} · Removed`,
      ...(entry.kind === "screen" && entry.variantOf !== undefined
        ? { variantOf: entry.variantOf }
        : {}),
    }),
  );
  const pages = buildNavSections(catalogue.hierarchy, removedLeaves).find(
    ({ id }) => id === "pages",
  );
  assert.ok(pages);
  const parentLeaf = findLeaf(pages.children, parent.path);
  assert.ok(parentLeaf);
  assert.deepEqual(
    parentLeaf.variants?.map(({ entryId, removedVariant }) => ({
      entryId,
      removedVariant: removedVariant ?? false,
    })),
    [
      { entryId: current.path, removedVariant: false },
      { entryId: removed.path, removedVariant: true },
    ],
  );
});

function screen(
  id: string,
  _route: string,
  variantOf?: string,
): ManifestScreen & {
  declaredDependencies: readonly string[];
} {
  return {
    colorSchemes: ["light"],
    declaredDependencies: [],
    description: `${id} screen`,
    path: id,
    kind: "screen",

    relatedDocs: [],
    sourcePath: `entries/${id}.mockup.tsx`,
    title: id,
    useCasePaths: [],
    ...(variantOf === undefined ? {} : { variantOf }),
  };
}

function findLeaf(
  nodes: readonly NavNode[],
  entryId: string,
): NavLeafNode | undefined {
  for (const node of nodes) {
    if (node.kind === "leaf" && node.entryId === entryId) return node;
    if (node.kind === "group") {
      const nested = findLeaf(node.children, entryId);
      if (nested) return nested;
    }
  }
  return undefined;
}
