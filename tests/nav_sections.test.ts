import assert from "node:assert/strict";
import test from "node:test";

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
import type { ShellRecoverySnapshot } from "../packages/viewer/dist/shell/store_state.js";

import { fixtureShellState } from "./helpers/viewer_catalogue.js";

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

test("screen variant leaves follow manifest order", () => {
  const parent = screen("welcome", "Welcome");
  const zeta = {
    ...screen("welcome-zeta", "Welcome zeta"),
    route: "welcome.variants/zeta.html",
    variantOf: parent.id,
  };
  const alpha = {
    ...screen("welcome-alpha", "Welcome alpha"),
    route: "welcome.variants/alpha.html",
    variantOf: parent.id,
  };
  const catalogue = createCatalogue(
    manifest([
      collection("screens", "Screens", [parent.id]),
      parent,
      zeta,
      alpha,
    ]),
  );

  const pages = buildNavSections(catalogue.hierarchy).find(
    ({ id }) => id === "pages",
  );
  assert.ok(pages);
  const parentLeaf = leaf(
    group(pages.children, "collection:screens").children,
    parent.title,
  );
  assert.deepEqual(
    parentLeaf.variants?.map(({ entryId }) => entryId),
    [zeta.id, alpha.id],
  );
});

test("page and component section disclosures persist independently", () => {
  const pagesClosed = fixtureShellState({
    href: "https://example.test/",
    initial: { recovery: recovery(["section:pages"]) },
  });
  assert.equal(pagesClosed.disclosures["section:pages"], false);
  assert.equal(pagesClosed.disclosures["section:components"], true);

  const componentsClosed = fixtureShellState({
    href: "https://example.test/",
    initial: { recovery: recovery(["section:components"]) },
  });
  assert.equal(componentsClosed.disclosures["section:pages"], true);
  assert.equal(componentsClosed.disclosures["section:components"], false);
});

test("legacy collection keys reach both projections without creating unknown keys", () => {
  const state = fixtureShellState({
    href: "https://example.test/",
    initial: {
      recovery: recovery(["/Product", "collection:product", "section:other"]),
    },
  });
  assert.equal(state.disclosures["collection:pages:product"], false);
  assert.equal(state.disclosures["collection:components:product"], false);
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

function recovery(
  closedCollectionIds: readonly string[],
): ShellRecoverySnapshot {
  return {
    closedCollectionIds,
    colorScheme: "light",
    detailsOpen: false,
    drawerOpen: false,
    filterBaselineClosedCollectionIds: null,
    navScroll: 0,
    query: "",
    regionScrolls: {},
    view: "all",
    viewport: "both",
  };
}
