import assert from "node:assert/strict";
import test from "node:test";

import { analyzeHierarchy } from "../src/registry/hierarchy.js";
import type { ManifestEntry, ManifestFolder } from "../src/registry/types.js";
import type { ShellContext } from "../src/shell/context.js";
import {
  defaultDisclosures,
  disclosurePath,
  navLeafVisible,
  navNodeVisible,
} from "../src/shell/nav_model.js";
import {
  buildNavSections,
  type NavGroupNode,
  type NavLeafNode,
  type NavNode,
  type NavSectionNode,
} from "../src/shell/nav_tree.js";

import { shellHierarchyFixture } from "./manifest_path_fixture.js";

const entry = (
  path: string,
  kind: string,
  title: string,
  variantOf?: string,
): ManifestEntry =>
  ({
    path,
    kind,
    title,
    sourcePath: `specs/${path}.mockup.tsx`,
    ...(variantOf ? { variantOf } : {}),
  }) as ManifestEntry;

const context: ShellContext = {
  base: "main",
  changedEntries: [],
  changesStatus: "ready",
  updateVersion: 1,
};

function sections(
  entries: readonly ManifestEntry[],
  folders: readonly ManifestFolder[] = [],
): readonly NavSectionNode[] {
  return buildNavSections(
    shellHierarchyFixture(analyzeHierarchy(entries, folders).hierarchy),
  );
}

function section(
  all: readonly NavSectionNode[],
  id: NavSectionNode["id"],
): NavSectionNode {
  const found = all.find((candidate) => candidate.id === id);
  assert.ok(found, id);
  return found;
}

function group(nodes: readonly NavNode[], key: string): NavGroupNode {
  const found = nodes.find(
    (node): node is NavGroupNode => node.kind === "group" && node.key === key,
  );
  assert.ok(found, key);
  return found;
}

function leaf(nodes: readonly NavNode[], entryId: string): NavLeafNode {
  const found = nodes.find(
    (node): node is NavLeafNode =>
      node.kind === "leaf" && node.entryId === entryId,
  );
  assert.ok(found, entryId);
  return found;
}

for (const kind of ["page", "document", "use-case"]) {
  test(`a ${kind} index stays a browse-only folder with its page first, labelled Overview`, () => {
    const specs = section(
      sections([
        entry("guide/intro", "screen", "Intro"),
        entry("guide", kind, "Guide"),
        entry("guide/appendix", "page", "Appendix"),
      ]),
      "specs",
    );
    const guide = group(specs.children, "folder:guide");
    assert.equal(guide.label, "Guide");
    const [first, ...rest] = guide.children;
    assert.ok(first?.kind === "leaf");
    assert.deepEqual(
      [first.entryId, first.entryKind, first.index, first.label, first.title],
      ["guide", kind, true, "Overview", "Guide"],
    );
    assert.deepEqual(
      rest.map((node) => node.label),
      ["Appendix", "Intro"],
    );
  });
}

test("an index page keeps its own title when the folder record names the folder", () => {
  const specs = section(
    sections(
      [
        entry("guide", "page", "Getting started"),
        entry("guide/a", "page", "A"),
      ],
      [{ path: "guide", title: "Handbook", sourcePath: "specs/guide.ts" }],
    ),
    "specs",
  );
  const guide = group(specs.children, "folder:guide");
  assert.equal(guide.label, "Handbook");
  const first = guide.children[0];
  assert.ok(first?.kind === "leaf");
  assert.deepEqual(
    [first.index, first.label, first.title],
    [true, "Getting started", "Getting started"],
  );
});

test("a screen index renders as one entry row listing its variants and then the folder's members", () => {
  const specs = section(
    sections([
      entry("billing/invoice", "screen", "Invoice"),
      entry("billing/invoice/overdue", "screen", "Overdue", "billing/invoice"),
      entry("billing/invoice/history", "screen", "History"),
      entry("billing/invoice/archive/old", "screen", "Old"),
    ]),
    "specs",
  );
  const billing = group(specs.children, "folder:billing");
  assert.equal(
    billing.children.some((node) => node.key === "folder:billing/invoice"),
    false,
  );
  const invoice = leaf(billing.children, "billing/invoice");
  assert.equal(invoice.index, undefined);
  assert.equal(invoice.label, "Invoice");
  assert.deepEqual(
    invoice.variants?.map(({ entryId }) => entryId),
    ["billing/invoice/overdue"],
  );
  assert.deepEqual(
    invoice.members?.map(({ key }) => key),
    ["folder:billing/invoice/archive", "entry:billing/invoice/history"],
  );
});

test("a component index lists its variants and members in Components only", () => {
  const all = sections([
    entry("kit/button", "component", "Button"),
    entry("kit/button/primary", "component", "Primary", "kit/button"),
    entry("kit/button/icon", "component", "Icon button"),
    entry("kit/demo", "screen", "Demo"),
  ]);
  const components = group(section(all, "components").children, "folder:kit");
  const button = leaf(components.children, "kit/button");
  assert.deepEqual(
    [
      button.variants?.map(({ entryId }) => entryId),
      button.members?.map(({ key }) => key),
    ],
    [["kit/button/primary"], ["entry:kit/button/icon"]],
  );
  const specs = group(section(all, "specs").children, "folder:kit");
  assert.deepEqual(
    specs.children.map(({ key }) => key),
    ["entry:kit/demo"],
  );
  const defaults = defaultDisclosures(all, undefined);
  assert.equal(defaults["folder:specs:kit"], true);
  assert.equal(defaults["folder:components:kit"], true);
  assert.equal(defaults["variants:kit/button"], false);
});

test("an index entry's list opens for a member route and exposes nested folders", () => {
  const all = sections([
    entry("billing/invoice", "screen", "Invoice"),
    entry("billing/invoice/overdue", "screen", "Overdue", "billing/invoice"),
    entry("billing/invoice/archive/old", "screen", "Old"),
    entry("billing/plans", "screen", "Plans"),
  ]);
  assert.deepEqual(disclosurePath(all, "billing/invoice/archive/old"), [
    "section:specs",
    "folder:specs:billing",
    "variants:billing/invoice",
    "folder:specs:billing/invoice/archive",
  ]);
  assert.deepEqual(disclosurePath(all, "billing/invoice"), [
    "section:specs",
    "folder:specs:billing",
    "variants:billing/invoice",
  ]);
  const active = defaultDisclosures(all, "billing/invoice/archive/old");
  assert.equal(active["variants:billing/invoice"], true);
  assert.equal(active["folder:specs:billing/invoice/archive"], true);
  const inactive = defaultDisclosures(all, "billing/plans");
  assert.equal(inactive["variants:billing/invoice"], false);
  assert.equal(inactive["folder:specs:billing/invoice/archive"], false);
});

test("search matches titles and path segments, not the Overview label", () => {
  const specs = section(
    sections([
      entry("handbook", "document", "Handbook"),
      entry("handbook/setup", "page", "Setup"),
    ]),
    "specs",
  );
  const overview = leaf(
    group(specs.children, "folder:handbook").children,
    "handbook",
  );
  const visible = (search: string) =>
    navLeafVisible(overview, { view: "all", search, tags: [] }, context);
  assert.equal(overview.label, "Overview");
  assert.equal(visible("overview"), false);
  assert.equal(visible("handbook"), true);
  assert.equal(visible("HANDBOOK"), true);
});

test("an index entry row stays visible while one of its members matches", () => {
  const specs = section(
    sections([
      entry("billing/invoice", "screen", "Invoice"),
      entry("billing/invoice/history", "screen", "History"),
    ]),
    "specs",
  );
  const invoice = leaf(
    group(specs.children, "folder:billing").children,
    "billing/invoice",
  );
  const matches = (search: string) =>
    navNodeVisible(invoice, { view: "all", search, tags: [] }, context);
  assert.equal(
    navLeafVisible(
      invoice,
      { view: "all", search: "History", tags: [] },
      context,
    ),
    false,
  );
  assert.equal(matches("History"), true);
  assert.equal(matches("missing"), false);
});
