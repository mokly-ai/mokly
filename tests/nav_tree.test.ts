import assert from "node:assert/strict";
import test from "node:test";

import type {
  ManifestCollection,
  ManifestEntry,
  ManifestPage,
  ManifestScreen,
  ManifestUseCase,
  ManifestV5,
} from "../packages/viewer/dist/registry/types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import {
  buildNavTree,
  structuredCrumbTrail,
  type NavGroupNode,
  type NavLeafNode,
  type NavNode,
} from "../packages/viewer/dist/shell/nav_tree.js";

test("duplicate collection titles retain independent stable identities", () => {
  const catalogue = createCatalogue(
    manifest([
      collection("alpha", "Same title", ["alpha-screen"]),
      collection("beta", "Same title", ["beta-screen"]),
      screen("alpha-screen", "Alpha screen"),
      screen("beta-screen", "Beta screen"),
    ]),
  );
  const groups = buildNavTree(catalogue.hierarchy);

  assert.deepEqual(
    groups.map((node) => [node.kind, node.key, node.label]),
    [
      ["group", "collection:alpha", "Same title"],
      ["group", "collection:beta", "Same title"],
    ],
  );
  assert.deepEqual(
    group(groups, "collection:alpha").children[0]?.label,
    "Alpha screen",
  );
  assert.deepEqual(
    group(groups, "collection:beta").children[0]?.label,
    "Beta screen",
  );
});

test("reparenting moves navigation and crumbs despite stale manifest navPath", () => {
  const before = createCatalogue(
    manifest([
      collection("alpha", "Alpha", ["target"]),
      collection("beta", "Beta", []),
      screen("target", "Target", ["Stored", "Wrong"]),
    ]),
  );
  const after = createCatalogue(
    manifest([
      collection("alpha", "Alpha", []),
      collection("beta", "Beta", ["target"]),
      screen("target", "Target", ["Stored", "Wrong"]),
    ]),
  );

  assert.deepEqual(structuredCrumbTrail(before.hierarchy, "target"), [
    { label: "Alpha" },
  ]);
  assert.deepEqual(structuredCrumbTrail(after.hierarchy, "target"), [
    { label: "Beta" },
  ]);
  assert.deepEqual(
    group(buildNavTree(before.hierarchy), "collection:alpha").children.map(
      ({ label }) => label,
    ),
    ["Target"],
  );
  assert.deepEqual(
    group(buildNavTree(after.hierarchy), "collection:beta").children.map(
      ({ label }) => label,
    ),
    ["Target"],
  );
});

test("root entries gain no invented group or breadcrumb", () => {
  const catalogue = createCatalogue(manifest([screen("root", "Root screen")]));
  const tree = buildNavTree(catalogue.hierarchy);

  assert.deepEqual(
    tree.map(({ kind, label }) => [kind, label]),
    [["leaf", "Root screen"]],
  );
  assert.deepEqual(structuredCrumbTrail(catalogue.hierarchy, "root"), []);
});

test("page ids stay unique and routes never create directory groups", () => {
  const pages: ManifestPage[] = [
    page("first", "Same Name", "same-name/index.html"),
    page("second", "Same Name", "same_name/index.html"),
  ];
  const catalogue = createCatalogue(manifest([], pages));
  const tree = buildNavTree(catalogue.hierarchy);

  assert.deepEqual(
    tree.map(({ label }) => label),
    ["Same Name", "Same Name"],
  );
  assert.deepEqual(
    new Set(tree.map(({ key }) => key)),
    new Set(["entry:first", "entry:second"]),
  );
});

test("declared entry tags reach their navigation leaves", () => {
  const pages: ManifestPage[] = [page("notes", "Notes", "legacy/notes.html")];
  const catalogue = createCatalogue(
    manifest(
      [
        collection("screens", "Screens", ["welcome", "details", "tour"]),
        screen("welcome", "Welcome", ["Screens"], ["forms", "onboarding"]),
        screen("details", "Details", ["Screens"]),
        useCase("tour", "Tour", ["onboarding"]),
      ],
      pages,
    ),
  );
  const children = group(
    buildNavTree(catalogue.hierarchy),
    "collection:screens",
  ).children;

  assert.deepEqual(leaf(children, "Welcome").tags, ["forms", "onboarding"]);
  assert.deepEqual(leaf(children, "Tour").tags, ["onboarding"]);
  assert.equal(leaf(children, "Details").tags, undefined);
  assert.equal(
    leaf(buildNavTree(catalogue.hierarchy), "Notes").tags,
    undefined,
  );
});

test("malformed cyclic hierarchy cannot recurse during nav construction", () => {
  const catalogue = createCatalogue(
    manifest([
      collection("alpha", "Alpha", ["beta"]),
      collection("beta", "Beta", ["alpha"]),
    ]),
  );
  assert.deepEqual(buildNavTree(catalogue.hierarchy), []);
});

function group(
  nodes: readonly (NavGroupNode | { kind: "leaf" })[],
  key: string,
): NavGroupNode {
  const match = nodes.find(
    (node): node is NavGroupNode => node.kind === "group" && node.key === key,
  );
  assert.ok(match);
  return match;
}

function leaf(nodes: readonly NavNode[], label: string): NavLeafNode {
  const match = nodes.find(
    (node): node is NavLeafNode => node.kind === "leaf" && node.label === label,
  );
  assert.ok(match);
  return match;
}

function collection(
  id: string,
  title: string,
  childIds: readonly string[],
): ManifestCollection {
  return {
    childIds,
    dependencies: [],
    description: `${title} collection`,
    id,
    kind: "collection",
    navPath: ["Historical"],
    relatedDocs: [],
    sourcePath: `entries/${id}.tsx`,
    title,
  };
}

function screen(
  id: string,
  title: string,
  navPath: readonly string[] = ["Historical"],
  tags?: readonly string[],
): ManifestScreen {
  return {
    dependencies: [],
    description: `${title} screen`,
    fragments: {
      desktop: `${id}.desktop.html`,
      mobile: `${id}.mobile.html`,
    },
    id,
    kind: "screen",
    navPath,
    relatedDocs: [],
    route: `${id}.html`,
    sourcePath: `entries/${id}.tsx`,
    title,
    useCaseIds: [],
    viewports: ["mobile", "desktop"],
    ...(tags ? { tags } : {}),
  };
}

function useCase(
  id: string,
  title: string,
  tags?: readonly string[],
): ManifestUseCase {
  return {
    dependencies: [],
    description: `${title} use case`,
    id,
    kind: "use-case",
    navPath: ["Screens"],
    relatedDocs: [],
    route: `${id}.html`,
    sourcePath: `entries/${id}.tsx`,
    steps: [],
    title,
    ...(tags ? { tags } : {}),
  };
}

function manifest(
  entries: readonly ManifestEntry[],
  pages: readonly ManifestPage[] = [],
): ManifestV5 {
  return {
    entries: [...entries, ...pages].map((entry) => ({
      ...entry,
      declaredDependencies: entry.declaredDependencies ?? [],
    })),
    generatedBy: "mokly",
    sourceFiles: [
      ...new Set([...entries, ...pages].map((entry) => entry.sourcePath)),
    ].sort(),
    schemaVersion: 5,
  };
}

function page(id: string, title: string, route: string): ManifestPage {
  return {
    id,
    title,
    route,
    kind: "page",
    description: title,
    dependencies: [],
    relatedDocs: [],
    navPath: [],
    sourcePath: `entries/${id}.tsx`,
  };
}
