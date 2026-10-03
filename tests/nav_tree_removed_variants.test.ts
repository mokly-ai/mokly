import assert from "node:assert/strict";
import test from "node:test";

import type {
  ManifestEntry,
  ManifestPage,
  ManifestScreen,
  ManifestV8,
} from "../packages/viewer/dist/registry/types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { targetHead } from "../packages/viewer/dist/shell/head.js";
import {
  buildNavSections,
  type NavLeafNode,
  type NavNode,
} from "../packages/viewer/dist/shell/nav_tree.js";
import { toRouteTarget } from "../packages/viewer/dist/shell/target.js";

import { currentManifest } from "./helpers/current_manifest.js";

const removed = {
  entryId: "welcome-error",
  entryKind: "screen" as const,
  key: "removed:welcome-error",
  kind: "leaf" as const,
  label: "Save failed · Removed",
  removedPage: true,
  variantOf: "welcome",
};

test("removed variants remain represented exactly once across parent transitions", () => {
  const cases = [
    {
      label: "surviving parent",
      entries: [screen("welcome", "Welcome", ["Screens"])],
      nested: true,
    },
    {
      label: "former parent became a variant",
      entries: [
        screen("workspace", "Workspace", ["Screens"]),
        variant("welcome", "Welcome", "workspace", ["Screens"]),
      ],
      nested: false,
    },
    {
      label: "parent was deleted",
      entries: [],
      nested: false,
    },
    {
      label: "parent changed kind",
      entries: [],
      pages: [page("welcome", "Welcome", "welcome.html")],
      nested: false,
    },
  ];

  for (const current of cases) {
    const sections = buildNavSections(
      createCatalogue(manifest(current.entries, current.pages)).hierarchy,
      [removed],
    );
    const nodes = sections.flatMap(({ children }) => children);
    assert.equal(occurrences(nodes, removed.entryId), 1, current.label);
    const represented = findLeaf(nodes, removed.entryId);
    assert.ok(represented, current.label);
    assert.equal(
      represented.removedVariant === true,
      current.nested,
      current.label,
    );
  }
});

test("an ineligible former parent remains a plain-text breadcrumb", () => {
  const removedVariant = variant("welcome-error", "Save failed", "welcome", [
    "Example",
    "Screens",
  ]);
  const catalogue = createCatalogue(
    manifest([
      screen("workspace", "Workspace", ["Example", "Screens"]),
      variant("welcome", "Welcome", "workspace", ["Example", "Screens"]),
    ]),
    [{ entry: removedVariant, snapshotId: "d".repeat(64) }],
  );
  const target = toRouteTarget(removedVariant);
  assert.ok(target);

  assert.deepEqual(targetHead(catalogue, target).crumbs, [
    { label: "Example" },
    { label: "Screens" },
    { label: "Welcome" },
  ]);
});

function findLeaf(
  nodes: readonly NavNode[],
  id: string,
): NavLeafNode | undefined {
  for (const node of nodes) {
    if (node.kind === "group") {
      const nested = findLeaf(node.children, id);
      if (nested) return nested;
    } else {
      if (node.entryId === id) return node;
      const nested = findLeaf(node.variants ?? [], id);
      if (nested) return nested;
    }
  }
  return undefined;
}

function occurrences(nodes: readonly NavNode[], id: string): number {
  return nodes.reduce((count, node) => {
    if (node.kind === "group") return count + occurrences(node.children, id);
    return (
      count + Number(node.entryId === id) + occurrences(node.variants ?? [], id)
    );
  }, 0);
}

function screen(
  id: string,
  title: string,
  navPath: readonly string[] = [],
): ManifestScreen {
  return {
    colorSchemes: ["light"],
    declaredDependencies: [],
    description: title,
    id,
    kind: "screen",
    navPath,
    relatedDocs: [],
    sourcePath: `entries/${id}.tsx`,
    title,
    useCaseIds: [],
  };
}

function variant(
  id: string,
  title: string,
  variantOf: string,
  navPath: readonly string[],
): ManifestScreen {
  return { ...screen(id, title, navPath), variantOf };
}

function page(id: string, title: string, _route: string): ManifestPage {
  return {
    declaredDependencies: [],
    description: title,
    id,
    kind: "page",
    navPath: [],
    relatedDocs: [],
    sourcePath: `entries/${id}.tsx`,
    title,
  };
}

function manifest(
  entries: readonly ManifestEntry[],
  pages: readonly ManifestPage[] = [],
): ManifestV8 {
  const all = [...entries, ...pages];
  return currentManifest({
    entries: all.map((entry) => ({
      ...entry,
      declaredDependencies: entry.declaredDependencies ?? [],
    })),
    generatedBy: "mokly",
    schemaVersion: 8,
    sourceFiles: [...new Set(all.map(({ sourcePath }) => sourcePath))].sort(),
  });
}
