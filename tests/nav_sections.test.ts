import assert from "node:assert/strict";
import test from "node:test";

import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "../packages/viewer/dist/components/manifest_types.js";
import type {
  ManifestEntry,
  ManifestScreen,
  ManifestV9,
} from "../packages/viewer/dist/registry/types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { reconcileDisclosures } from "../packages/viewer/dist/shell/disclosure_storage.js";
import {
  defaultDisclosures,
  disclosurePath,
} from "../packages/viewer/dist/shell/nav_model.js";
import {
  buildNavSections,
  type NavGroupNode,
  type NavLeafNode,
  type NavNode,
} from "../packages/viewer/dist/shell/nav_tree.js";
import type { ShellRecoverySnapshot } from "../packages/viewer/dist/shell/store_state.js";

import { currentManifest } from "./helpers/current_manifest.js";
import { fixtureShellState } from "./helpers/viewer_catalogue.js";

test("Specs and Components sections preserve only their relevant hierarchy", () => {
  const catalogue = createCatalogue(
    manifest([
      screen("Product/Screens/welcome", "Welcome"),
      component("Product/Library/action", "Action"),
    ]),
  );

  const sections = buildNavSections(catalogue.hierarchy);

  assert.deepEqual(
    sections.map(({ id, key, label }) => [id, key, label]),
    [
      ["specs", "section:specs", "Specs"],
      ["components", "section:components", "Components"],
    ],
  );
  const pageRoot = group(sections[0]?.children ?? [], "folder:Product");
  assert.deepEqual(
    pageRoot.children.map(({ label }) => label),
    ["Screens"],
  );
  assert.equal(
    leaf(group(pageRoot.children, "folder:Product/Screens").children, "Welcome")
      .entryKind,
    "screen",
  );
  const componentRoot = group(sections[1]?.children ?? [], "folder:Product");
  assert.deepEqual(
    componentRoot.children.map(({ label }) => label),
    ["Library"],
  );
  assert.equal(
    leaf(
      group(componentRoot.children, "folder:Product/Library").children,
      "Action",
    ).entryKind,
    "component",
  );
});

test("screen variant leaves follow manifest order", () => {
  const parent = screen("Screens/welcome", "Welcome");
  const zeta = {
    ...screen("Screens/welcome-zeta", "Welcome zeta"),
    variantOf: parent.path,
  };
  const alpha = {
    ...screen("Screens/welcome-alpha", "Welcome alpha"),
    variantOf: parent.path,
  };
  const catalogue = createCatalogue(manifest([parent, zeta, alpha]));

  const specs = buildNavSections(catalogue.hierarchy).find(
    ({ id }) => id === "specs",
  );
  assert.ok(specs);
  const parentLeaf = leaf(
    group(specs.children, "folder:Screens").children,
    parent.title,
  );
  assert.deepEqual(
    parentLeaf.variants?.map(({ entryId }) => entryId),
    [zeta.path, alpha.path],
  );
});

test("Specs and Components section disclosures persist independently", () => {
  const specsClosed = fixtureShellState({
    href: "https://example.test/",
    initial: { recovery: recovery({ "section:specs": false }) },
  });
  assert.equal(specsClosed.disclosures["section:specs"], false);
  assert.equal(specsClosed.disclosures["section:components"], true);

  const componentsClosed = fixtureShellState({
    href: "https://example.test/",
    initial: { recovery: recovery({ "section:components": false }) },
  });
  assert.equal(componentsClosed.disclosures["section:specs"], true);
  assert.equal(componentsClosed.disclosures["section:components"], false);
});

test("folder identities use paths and remain section-local", () => {
  const catalogue = createCatalogue(
    manifest([
      screen("design-system/Browse/a", "A"),
      component("design-system/Browse/b", "B"),
    ]),
  );
  const sections = buildNavSections(catalogue.hierarchy);
  for (const section of sections) {
    const parent = group(section.children, "folder:design-system");
    assert.equal(
      group(parent.children, "folder:design-system/Browse").label,
      "Browse",
    );
  }
  const defaults = defaultDisclosures(sections, undefined);
  assert.deepEqual(disclosurePath(sections, "design-system/Browse/a"), [
    "section:specs",
    "folder:specs:design-system",
    "folder:specs:design-system/Browse",
  ]);
  assert.equal(defaults["folder:specs:design-system/Browse"], false);
  assert.equal(defaults["folder:components:design-system/Browse"], false);
  assert.deepEqual(
    reconcileDisclosures(
      defaults,
      { "folder:specs:design-system": false },
      "default",
    ),
    { ...defaults, "folder:specs:design-system": false },
  );
  const specsClosed = fixtureShellState({
    href: "https://example.test/",
    initial: { recovery: recovery({ "folder:specs:product": false }) },
  });
  assert.equal(specsClosed.disclosures["folder:specs:product"], false);
  assert.equal(specsClosed.disclosures["folder:components:components"], true);
});

test("earlier key forms naming current folder paths are never read or translated", () => {
  const state = fixtureShellState({
    href: "https://example.test/",
    initial: {
      recovery: recovery({
        "section:pages": false,
        "folder:pages:product": false,
        "collection:pages:product": false,
        "collection:components:components": false,
        "collection:product": false,
        "legacy:product": false,
      }),
    },
  });
  assert.equal(state.disclosures["section:specs"], true);
  assert.equal(state.disclosures["folder:specs:product"], true);
  assert.equal(state.disclosures["folder:components:components"], true);
  for (const key of ["section:pages", "folder:pages:product"])
    assert.equal(Object.hasOwn(state.disclosures, key), false, key);
});

test("unknown disclosure keys never create unknown disclosure state", () => {
  const state = fixtureShellState({
    href: "https://example.test/",
    initial: {
      recovery: recovery({ "/Product": false, "section:other": false }),
    },
  });
  assert.equal(state.disclosures["folder:specs:product"], true);
  assert.equal(state.disclosures["folder:components:components"], true);
  assert.equal(Object.hasOwn(state.disclosures, "section:other"), false);
});

function group(nodes: readonly NavNode[], key: string): NavGroupNode {
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

function screen(id: string, title: string): ManifestScreen {
  return {
    colorSchemes: ["light"],
    declaredDependencies: [],
    description: `${title} screen`,
    path: id,
    kind: "screen",
    relatedDocs: [],
    sourcePath: `entries/${id}.tsx`,
    title,
    useCasePaths: [],
  };
}

function component(id: string, title: string): ManifestComponent {
  return {
    colorSchemes: ["light"],
    controls: {},
    declaredDependencies: [],
    description: `${title} component`,
    path: id,
    kind: "component",
    ownedDependencies: [],
    propSchema: { kind: "object", properties: {} },
    relatedDocs: [],
    slots: [],
    sourcePath: `entries/${id}.tsx`,
    title,
  };
}

function manifest(entries: readonly ManifestEntry[]): ManifestV9 {
  return currentManifest({
    entries: entries.flatMap((entry) => [
      {
        ...entry,
        declaredDependencies: entry.declaredDependencies ?? [],
      },
      ...(entry.kind === "component" && !("variantOf" in entry)
        ? [componentVariant(entry)]
        : []),
    ]),
    generatedBy: "mokly",
    schemaVersion: 9 as const,
    folders: [],
    sourceFiles: [
      ...new Set(entries.map(({ sourcePath }) => sourcePath)),
    ].sort(),
  });
}

function componentVariant(parent: ManifestComponent): ManifestComponentVariant {
  const id = `${parent.path}/default`;
  return {
    colorSchemes: parent.colorSchemes,
    componentViews: [],
    declaredDependencies: [],
    description: parent.description,
    path: id,
    kind: "component",

    props: {},
    relatedDocs: parent.relatedDocs,
    sourcePath: parent.sourcePath,
    suppliedSlots: [],
    title: "Default",
    variantOf: parent.path,
  };
}

function recovery(
  disclosures: Readonly<Record<string, boolean>>,
): ShellRecoverySnapshot {
  return {
    disclosures,
    colorScheme: "light",
    detailsOpen: false,
    drawerOpen: false,
    filterBaselineDisclosures: null,
    navScroll: 0,
    query: "",
    regionScrolls: {},
    view: "all",
    viewport: "both",
  };
}
