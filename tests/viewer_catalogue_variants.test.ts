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
  const parent = screen("welcome", "screens/welcome.html");
  const current = screen(
    "welcome-empty",
    "screens/welcome.variants/empty.html",
    parent.id,
  );
  const removed = screen(
    "welcome-error",
    "screens/welcome.variants/error.html",
    parent.id,
  );
  const manifest = {
    entries: [parent, current],
    generatedBy: "mokly" as const,
    schemaVersion: 5 as const,
    sourceFiles: [parent.sourcePath, current.sourcePath].sort(),
  };
  const model = projectCatalogue({
    catalogue: createCatalogue(manifest, [{ entry: removed, ancestors: [] }]),
    changesStatus: "ready",
    changedRoutes: [current.route],
    comparisonUrl: null,
    configPath: "mokly.config.ts",
    revision: { content: 0, evidence: 1 },
  });

  const catalogue = viewerCatalogue(model);
  assert.deepEqual(
    catalogue.hierarchy.variantsById.get(parent.id)?.map(({ id }) => id),
    [current.id],
  );
  assert.equal(
    catalogue.hierarchy.variantParentById.get(current.id)?.id,
    parent.id,
  );
  const removedEntry = catalogue.removedEntries[0]?.entry;
  assert.equal(
    removedEntry?.kind === "screen" ? removedEntry.variantOf : undefined,
    parent.id,
  );

  const removedLeaves = catalogue.removedEntries.map(
    ({ entry }): NavLeafNode => ({
      entryId: entry.id,
      entryKind: entry.kind,
      key: `removed:${entry.route}`,
      kind: "leaf",
      label: `${entry.title} · Removed`,
      route: entry.route,
      ...(entry.kind === "screen" && entry.variantOf !== undefined
        ? { variantOf: entry.variantOf }
        : {}),
    }),
  );
  const pages = buildNavSections(catalogue.hierarchy, removedLeaves).find(
    ({ id }) => id === "pages",
  );
  assert.ok(pages);
  const parentLeaf = findLeaf(pages.children, parent.id);
  assert.ok(parentLeaf);
  assert.deepEqual(
    parentLeaf.variants?.map(({ entryId, removedVariant }) => ({
      entryId,
      removedVariant: removedVariant ?? false,
    })),
    [
      { entryId: current.id, removedVariant: false },
      { entryId: removed.id, removedVariant: true },
    ],
  );
});

function screen(
  id: string,
  route: string,
  variantOf?: string,
): ManifestScreen & {
  declaredDependencies: readonly string[];
} {
  const stem = route.slice(0, -".html".length);
  return {
    declaredDependencies: [],
    dependencies: [],
    description: `${id} screen`,
    fragments: {
      desktop: `${stem}.desktop.html`,
      mobile: `${stem}.mobile.html`,
    },
    id,
    kind: "screen",
    navPath: [],
    relatedDocs: [],
    route,
    sourcePath: `entries/${id}.mockup.tsx`,
    title: id,
    useCaseIds: [],
    ...(variantOf === undefined ? {} : { variantOf }),
    viewports: ["mobile", "desktop"],
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
