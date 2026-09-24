import assert from "node:assert/strict";
import test from "node:test";

import type {
  ManifestCollection,
  ManifestEntry,
  ManifestPage,
  ManifestScreen,
  ManifestV6,
} from "../packages/viewer/dist/registry/types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import {
  buildNavSections,
  type NavLeafNode,
  type NavNode,
} from "../packages/viewer/dist/shell/nav_tree.js";

const removed = {
  entryKind: "screen" as const,
  key: "removed:welcome-error",
  kind: "leaf" as const,
  label: "Save failed · Removed",
  removedPage: true,
  route: "welcome-error.html",
  variantOf: "welcome",
};

test("removed variants remain represented exactly once across parent transitions", () => {
  const cases = [
    {
      label: "surviving parent",
      entries: [
        collection("screens", "Screens", ["welcome"]),
        screen("welcome", "Welcome"),
      ],
      nested: true,
    },
    {
      label: "former parent became a variant",
      entries: [
        collection("screens", "Screens", ["workspace"]),
        screen("workspace", "Workspace"),
        variant("welcome", "Welcome", "workspace"),
      ],
      nested: false,
    },
    {
      label: "parent was deleted",
      entries: [collection("screens", "Screens", [])],
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
    assert.equal(occurrences(nodes, removed.route), 1, current.label);
    const represented = findLeaf(nodes, removed.route);
    assert.ok(represented, current.label);
    assert.equal(
      represented.removedVariant === true,
      current.nested,
      current.label,
    );
  }
});

function findLeaf(
  nodes: readonly NavNode[],
  route: string,
): NavLeafNode | undefined {
  for (const node of nodes) {
    if (node.kind === "group") {
      const nested = findLeaf(node.children, route);
      if (nested) return nested;
    } else {
      if (node.route === route) return node;
      const nested = findLeaf(node.variants ?? [], route);
      if (nested) return nested;
    }
  }
  return undefined;
}

function occurrences(nodes: readonly NavNode[], route: string): number {
  return nodes.reduce((count, node) => {
    if (node.kind === "group") return count + occurrences(node.children, route);
    return (
      count +
      Number(node.route === route) +
      occurrences(node.variants ?? [], route)
    );
  }, 0);
}

function collection(
  id: string,
  title: string,
  childIds: readonly string[],
): ManifestCollection {
  return {
    childIds,
    description: title,
    id,
    kind: "collection",
    navPath: [],
    relatedDocs: [],
    sourcePath: `entries/${id}.tsx`,
    title,
  };
}

function screen(id: string, title: string): ManifestScreen {
  return {
    description: title,
    fragments: {
      desktop: `${id}.desktop.html`,
      mobile: `${id}.mobile.html`,
    },
    id,
    kind: "screen",
    navPath: [],
    relatedDocs: [],
    route: `${id}.html`,
    sourcePath: `entries/${id}.tsx`,
    title,
    useCaseIds: [],
    viewports: ["mobile", "desktop"],
  };
}

function variant(id: string, title: string, variantOf: string): ManifestScreen {
  return { ...screen(id, title), variantOf };
}

function page(id: string, title: string, route: string): ManifestPage {
  return {
    description: title,
    id,
    kind: "page",
    navPath: [],
    relatedDocs: [],
    route,
    sourcePath: `entries/${id}.tsx`,
    title,
  };
}

function manifest(
  entries: readonly ManifestEntry[],
  pages: readonly ManifestPage[] = [],
): ManifestV6 {
  const all = [...entries, ...pages];
  return {
    entries: all,
    generatedBy: "mokly",
    schemaVersion: 6,
    sourceFiles: [...new Set(all.map(({ sourcePath }) => sourcePath))].sort(),
  };
}
