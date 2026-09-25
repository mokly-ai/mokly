import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestComponent } from "../packages/viewer/dist/components/manifest_types.js";
import type {
  ManifestEntry,
  ManifestScreen,
  ManifestV6,
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

import { fixtureShellState } from "./helpers/viewer_catalogue.js";

test("page and component sections preserve only their relevant hierarchy", () => {
  const catalogue = createCatalogue(
    manifest([
      screen("welcome", "Welcome", ["Product", "Screens"]),
      component("action", "Action", ["Product", "Library"]),
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
  const parent = screen("welcome", "Welcome", ["Screens"]);
  const zeta = {
    ...screen("welcome-zeta", "Welcome zeta", ["Screens"]),
    route: "welcome.variants/zeta.html",
    variantOf: parent.id,
  };
  const alpha = {
    ...screen("welcome-alpha", "Welcome alpha", ["Screens"]),
    route: "welcome.variants/alpha.html",
    variantOf: parent.id,
  };
  const catalogue = createCatalogue(manifest([parent, zeta, alpha]));

  const pages = buildNavSections(catalogue.hierarchy).find(
    ({ id }) => id === "pages",
  );
  assert.ok(pages);
  const parentLeaf = leaf(
    group(pages.children, "folder:Screens").children,
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
    initial: { recovery: recovery({ "section:pages": false }) },
  });
  assert.equal(pagesClosed.disclosures["section:pages"], false);
  assert.equal(pagesClosed.disclosures["section:components"], true);

  const componentsClosed = fixtureShellState({
    href: "https://example.test/",
    initial: { recovery: recovery({ "section:components": false }) },
  });
  assert.equal(componentsClosed.disclosures["section:pages"], true);
  assert.equal(componentsClosed.disclosures["section:components"], false);
});

test("folder identities preserve colons and remain section-local", () => {
  const catalogue = createCatalogue(
    manifest([
      screen("a", "A", ["Design: System", "Browse"]),
      component("b", "B", ["Design: System", "Browse"]),
    ]),
  );
  const sections = buildNavSections(catalogue.hierarchy);
  for (const section of sections) {
    const parent = group(section.children, "folder:Design: System");
    assert.equal(
      group(parent.children, "folder:Design: System/Browse").label,
      "Browse",
    );
  }
  const defaults = defaultDisclosures(sections, undefined);
  assert.deepEqual(disclosurePath(sections, "a.html"), [
    "section:pages",
    "folder:pages:Design: System",
    "folder:pages:Design: System/Browse",
  ]);
  assert.equal(defaults["folder:pages:Design: System/Browse"], false);
  assert.equal(defaults["folder:components:Design: System/Browse"], false);
  assert.deepEqual(
    reconcileDisclosures(
      defaults,
      { "folder:pages:Design: System": false },
      "default",
    ),
    { ...defaults, "folder:pages:Design: System": false },
  );
  const pagesClosed = fixtureShellState({
    href: "https://example.test/",
    initial: { recovery: recovery({ "folder:pages:Product": false }) },
  });
  assert.equal(pagesClosed.disclosures["folder:pages:Product"], false);
  assert.equal(pagesClosed.disclosures["folder:components:Product"], true);
});

test("obsolete sectioned and pre-section collection keys never close folders", () => {
  const state = fixtureShellState({
    href: "https://example.test/",
    initial: {
      recovery: recovery({
        "collection:pages:Product": false,
        "collection:components:Product": false,
        "collection:Product": false,
        "legacy:Product": false,
      }),
    },
  });
  assert.equal(state.disclosures["folder:pages:Product"], true);
  assert.equal(state.disclosures["folder:components:Product"], true);
});

test("unknown disclosure keys never create unknown disclosure state", () => {
  const state = fixtureShellState({
    href: "https://example.test/",
    initial: {
      recovery: recovery({ "/Product": false, "section:other": false }),
    },
  });
  assert.equal(state.disclosures["folder:pages:Product"], true);
  assert.equal(state.disclosures["folder:components:Product"], true);
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

function screen(
  id: string,
  title: string,
  navPath: readonly string[] = [],
): ManifestScreen {
  return {
    dependencies: [],
    description: `${title} screen`,
    fragments: { desktop: `${id}.desktop.html`, mobile: `${id}.mobile.html` },
    id,
    kind: "screen",
    navPath,
    relatedDocs: [],
    route: `${id}.html`,
    sourcePath: `entries/${id}.tsx`,
    title,
    useCaseIds: [],
    viewports: ["mobile", "desktop"],
  };
}

function component(
  id: string,
  title: string,
  navPath: readonly string[] = [],
): ManifestComponent {
  return {
    controls: {},
    declaredDependencies: [],
    dependencies: [],
    description: `${title} component`,
    id,
    kind: "component",
    navPath,
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

function manifest(entries: readonly ManifestEntry[]): ManifestV6 {
  return {
    entries: entries.map((entry) => ({
      ...entry,
      declaredDependencies: entry.declaredDependencies ?? [],
    })),
    generatedBy: "mokly",
    schemaVersion: 6,
    sourceFiles: [
      ...new Set(entries.map(({ sourcePath }) => sourcePath)),
    ].sort(),
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
