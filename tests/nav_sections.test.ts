import assert from "node:assert/strict";
import test from "node:test";

import {
  isNavDisclosureClosed,
  isNavDisclosureKey,
  NavDisclosurePreference,
  type NavPreferenceStorage,
} from "../packages/viewer/dist/client/browse_navigation.js";
import type { ManifestComponent } from "../packages/viewer/dist/components/manifest_types.js";
import type {
  ManifestCollection,
  ManifestEntry,
  ManifestScreen,
  ManifestV5,
} from "../packages/viewer/dist/registry/types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import {
  buildNavSections,
  type NavGroupNode,
  type NavLeafNode,
  type NavNode,
} from "../packages/viewer/dist/shell/nav_tree.js";

import { asDocument, FakeNode } from "./helpers/fake_dom.js";

test("page and component sections preserve only their relevant hierarchy", () => {
  const catalogue = createCatalogue(
    manifest([
      collection("root", "Product", ["screens", "library", "empty"]),
      collection("screens", "Screens", ["welcome"]),
      collection("library", "Library", ["action"]),
      collection("empty", "Future pages", []),
      screen("welcome", "Welcome"),
      component("action", "Action"),
    ]),
  );

  const sections = buildNavSections(catalogue.hierarchy);

  assert.deepEqual(
    sections.map(({ id, key, label }) => [id, key, label]),
    [
      ["pages", "section:pages", "Pages"],
      ["components", "section:components", "Components"],
    ],
  );
  const pageRoot = group(sections[0]?.children ?? [], "collection:root");
  assert.deepEqual(
    pageRoot.children.map(({ label }) => label),
    ["Future pages", "Screens"],
  );
  assert.equal(
    leaf(group(pageRoot.children, "collection:screens").children, "Welcome")
      .entryKind,
    "screen",
  );
  const componentRoot = group(sections[1]?.children ?? [], "collection:root");
  assert.deepEqual(
    componentRoot.children.map(({ label }) => label),
    ["Library"],
  );
  assert.equal(
    leaf(group(componentRoot.children, "collection:library").children, "Action")
      .entryKind,
    "component",
  );
});

test("page and component section disclosures persist independently", () => {
  const storage = new FakeStorage();
  const firstPages = disclosure("section:pages", false);
  const firstComponents = disclosure("section:components", true);
  new NavDisclosurePreference(storage).remember(
    documentWith(firstPages, firstComponents),
  );

  const nextPages = disclosure("section:pages", true);
  const nextComponents = disclosure("section:components", false);
  new NavDisclosurePreference(storage).apply(
    documentWith(nextPages, nextComponents),
  );

  assert.equal(nextPages.open, false);
  assert.equal(nextComponents.open, true);
});

test("section keys are valid and legacy collection keys reach both projections", () => {
  assert.equal(isNavDisclosureKey("collection:pages:example"), true);
  assert.equal(isNavDisclosureKey("section:pages"), true);
  assert.equal(isNavDisclosureKey("section:components"), true);
  assert.equal(isNavDisclosureKey("section:other"), false);
  const closed = new Set(["collection:example"]);
  assert.equal(isNavDisclosureClosed(closed, "collection:pages:example"), true);
  assert.equal(
    isNavDisclosureClosed(closed, "collection:components:example"),
    true,
  );
  assert.equal(isNavDisclosureClosed(closed, "collection:pages:other"), false);
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
    navPath: [],
    relatedDocs: [],
    sourcePath: `entries/${id}.tsx`,
    title,
  };
}

function screen(id: string, title: string): ManifestScreen {
  return {
    dependencies: [],
    description: `${title} screen`,
    fragments: { desktop: `${id}.desktop.html`, mobile: `${id}.mobile.html` },
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

function component(id: string, title: string): ManifestComponent {
  return {
    controls: {},
    declaredDependencies: [],
    dependencies: [],
    description: `${title} component`,
    id,
    kind: "component",
    navPath: [],
    ownedDependencies: [],
    propSchema: { kind: "object", properties: {} },
    relatedDocs: [],
    route: `components/${id}.html`,
    slots: [],
    sourcePath: `entries/${id}.tsx`,
    title,
    variants: [
      {
        componentViews: [],
        fragments: {
          desktop: `components/${id}.desktop.html`,
          mobile: `components/${id}.mobile.html`,
        },
        id: "default",
        props: {},
        suppliedSlots: [],
        title: "Default",
      },
    ],
    viewports: ["mobile", "desktop"],
  };
}

function manifest(entries: readonly ManifestEntry[]): ManifestV5 {
  return {
    entries: entries.map((entry) => ({
      ...entry,
      declaredDependencies: entry.declaredDependencies ?? [],
    })),
    generatedBy: "mokly",
    schemaVersion: 5,
    sourceFiles: entries.map(({ sourcePath }) => sourcePath).sort(),
  };
}

function disclosure(key: string, open: boolean): FakeNode {
  const node = new FakeNode("details", { "data-nav-disclosure": key });
  node.open = open;
  return node;
}

function documentWith(...disclosures: readonly FakeNode[]): Document {
  return asDocument(new FakeNode("div").append(...disclosures));
}

class FakeStorage implements NavPreferenceStorage {
  value: string | null = null;

  getItem(): string | null {
    return this.value;
  }

  setItem(_key: string, value: string): void {
    this.value = value;
  }
}
