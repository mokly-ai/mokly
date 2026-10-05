import assert from "node:assert/strict";
import test from "node:test";

import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import type { ShellContext } from "../packages/viewer/dist/shell/context.js";
import { structuredCrumbTrail } from "../packages/viewer/dist/shell/crumbs.js";
import {
  catalogueNavSections,
  navLeafVisible,
} from "../packages/viewer/dist/shell/nav_model.js";
import type {
  NavLeafNode,
  NavNode,
} from "../packages/viewer/dist/shell/nav_tree.js";

import { pathFixture } from "./helpers/path_fixture.js";

const context: ShellContext = {
  base: "main",
  changedEntries: [],
  changesStatus: "ready",
  updateVersion: 1,
};

/** Compile Markdown folders through the registry into navigation rows. */
async function compiled(t: test.TestContext) {
  const fixture = await pathFixture({
    "specs/guide/index.md": "# Guide\n\nThe guide's own page.\n",
    "specs/guide/setup.md": "# Setup\n",
    "specs/handbook/_folder.json": JSON.stringify({ title: "Handbook" }),
    "specs/handbook/README.md":
      '---\ntitle: Team handbook\ntags: ["guide"]\n---\n# Team handbook\n',
    "specs/handbook/setup.md": "# Onboarding\n",
  });
  t.after(fixture.remove);
  const catalogue = createCatalogue((await fixture.compile()).manifest);
  const [specs] = catalogueNavSections(catalogue);
  assert.equal(specs?.id, "specs");
  return { catalogue, specs };
}

/** One folder's child rows as `kind:entry:label`, index rows marked. */
function rows(nodes: readonly NavNode[], key: string): string[] {
  const folder = nodes.find((node) => node.key === key);
  assert.ok(folder?.kind === "group", `missing ${key}`);
  return folder.children.map((node) =>
    node.kind === "group"
      ? `folder:${node.label}`
      : `${node.entryKind}:${node.entryId}:${node.label}${node.index ? " [index]" : ""}`,
  );
}

function leaf(nodes: readonly NavNode[], key: string, id: string) {
  const folder = nodes.find((node) => node.key === key);
  assert.ok(folder?.kind === "group");
  const found = folder.children.find(
    (node): node is NavLeafNode => node.kind === "leaf" && node.entryId === id,
  );
  assert.ok(found, `missing ${id}`);
  return found;
}

test("Markdown folder pages are their folder's first document row", async (t) => {
  const { specs } = await compiled(t);
  assert.deepEqual(rows(specs.children, "folder:guide"), [
    "document:guide:Overview [index]",
    "document:guide/setup:Setup",
  ]);
  assert.deepEqual(rows(specs.children, "folder:handbook"), [
    "document:handbook:Team handbook [index]",
    "document:handbook/setup:Onboarding",
  ]);
});

test("search finds Markdown documents by title, path segment, tag, and folder title", async (t) => {
  const { specs } = await compiled(t);
  const readme = leaf(specs.children, "folder:handbook", "handbook");
  const setup = leaf(specs.children, "folder:handbook", "handbook/setup");
  const visible = (search: string, tags: readonly string[] = []) =>
    [readme, setup]
      .filter((row) =>
        navLeafVisible(row, { view: "all", search, tags }, context),
      )
      .map((row) => row.entryId);
  assert.deepEqual(visible("team handbook"), ["handbook"]);
  assert.deepEqual(visible("onboarding"), ["handbook/setup"]);
  assert.deepEqual(visible("handbook/setup"), ["handbook/setup"]);
  assert.deepEqual(visible("", ["guide"]), ["handbook"]);
  assert.deepEqual(visible("Handbook"), ["handbook", "handbook/setup"]);
});

test("a document's crumb opens its folder's Markdown page", async (t) => {
  const { catalogue } = await compiled(t);
  assert.deepEqual(structuredCrumbTrail(catalogue.hierarchy, "guide/setup"), [
    { href: "/view/guide/", label: "Guide" },
  ]);
  assert.deepEqual(
    structuredCrumbTrail(catalogue.hierarchy, "handbook/setup"),
    [{ href: "/view/handbook/", label: "Handbook" }],
  );
  assert.deepEqual(structuredCrumbTrail(catalogue.hierarchy, "handbook"), []);
});
