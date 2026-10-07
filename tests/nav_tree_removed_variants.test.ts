import assert from "node:assert/strict";
import test from "node:test";

import type {
  ManifestEntry,
  ManifestPage,
  ManifestScreen,
  ManifestV9,
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
  title: "Save failed",
  parentId: "welcome",
};

test("removed variants remain represented exactly once across parent transitions", () => {
  const cases = [
    {
      label: "surviving parent",
      entries: [screen("welcome", "Welcome")],
      nested: true,
    },
    {
      label: "former parent became a variant",
      entries: [
        screen("workspace", "Workspace"),
        variant("welcome", "Welcome", "workspace"),
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

test("a removed variant attaches to a parent listed among a folder's own screen members", () => {
  const nestedRemoved = {
    ...removed,
    entryId: "billing/welcome/error",
    key: "removed:billing/welcome/error",
    parentId: "billing/welcome",
  };
  const sections = buildNavSections(
    createCatalogue(
      manifest([
        screen("billing", "Billing"),
        screen("billing/welcome", "Welcome"),
      ]),
    ).hierarchy,
    [nestedRemoved],
  );
  const nodes = sections.flatMap(({ children }) => children);
  const index = nodes[0];
  assert.ok(index?.kind === "leaf");
  assert.equal(index.entryId, "billing");
  const parent = index.members?.[0];
  assert.ok(parent?.kind === "leaf");
  assert.deepEqual(
    parent.variants?.map(({ entryId, removedVariant }) => [
      entryId,
      removedVariant,
    ]),
    [["billing/welcome/error", true]],
  );
  assert.equal(nodes.length, 1);
});

test("an ineligible former parent remains a plain-text breadcrumb", () => {
  const removedVariant = variant("welcome-error", "Save failed", "welcome");
  const catalogue = createCatalogue(
    manifest([
      screen("workspace", "Workspace"),
      variant("welcome", "Welcome", "workspace"),
    ]),
    [
      {
        folderTitles: ["Example", "Screens"],
        entry: removedVariant,
        parentTitle: "Welcome",
        snapshotId: "d".repeat(64),
      },
    ],
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

function screen(id: string, title: string): ManifestScreen {
  return {
    colorSchemes: ["light"],
    declaredDependencies: [],
    description: title,
    path: id,
    kind: "screen",
    relatedDocs: [],
    sourcePath: `entries/${id}.tsx`,
    title,
    useCasePaths: [],
  };
}

function variant(id: string, title: string, variantOf: string): ManifestScreen {
  return { ...screen(id, title), variantOf };
}

function page(id: string, title: string, _route: string): ManifestPage {
  return {
    declaredDependencies: [],
    description: title,
    path: id,
    kind: "page",

    relatedDocs: [],
    sourcePath: `entries/${id}.tsx`,
    title,
  };
}

function manifest(
  entries: readonly ManifestEntry[],
  pages: readonly ManifestPage[] = [],
): ManifestV9 {
  const all = [...entries, ...pages];
  return currentManifest({
    entries: all.map((entry) => ({
      ...entry,
      declaredDependencies: entry.declaredDependencies ?? [],
    })),
    generatedBy: "mokly",
    schemaVersion: 9 as const,
    folders: [],
    sourceFiles: [...new Set(all.map(({ sourcePath }) => sourcePath))].sort(),
  });
}
