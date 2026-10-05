import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { changesActivation } from "../packages/viewer/src/shell/changes_activation.js";
import { EntryDetailsBody } from "../packages/viewer/src/shell/details.js";
import { targetHead } from "../packages/viewer/src/shell/head.js";
import { catalogueNavSections } from "../packages/viewer/src/shell/nav_model.js";
import type {
  NavLeafNode,
  NavNode,
} from "../packages/viewer/src/shell/nav_tree.js";
import { toRouteTarget } from "../packages/viewer/src/shell/target.js";
import { defaultSelection } from "../packages/viewer/src/viewer/selection.js";

import { branchPointShell, routedEntry } from "./helpers/branch_point_shell.js";

function leaf(nodes: readonly NavNode[], id: string): NavLeafNode | undefined {
  for (const node of nodes) {
    const found =
      node.kind === "group"
        ? leaf(node.children, id)
        : node.entryId === id
          ? node
          : leaf([...(node.variants ?? []), ...(node.members ?? [])], id);
    if (found) return found;
  }
  return undefined;
}

const cases = {
  "moved-parent": {
    parent: "library/archive/action",
    removed: "library/action/secondary",
    container: "library",
    variants: [
      ["library/archive/action/primary", false],
      ["library/action/secondary", true],
    ],
    crumbs: [
      { label: "Library" },
      { href: "/view/library/archive/action/", label: "Action" },
    ],
    heading: "Action",
  },
  "case-renames": {
    parent: "library/action",
    removed: "library/Action/secondary",
    container: "library/action",
    variants: [
      ["library/action/primary", false],
      ["library/Action/secondary", true],
    ],
    crumbs: [
      { label: "Library" },
      { href: "/view/library/action/", label: "Action" },
    ],
    heading: "Action",
  },
} as const;

for (const [name, expected] of Object.entries(cases)) {
  test(`${name}: the removed sibling attaches under its resolved parent`, async (t) => {
    const shell = await branchPointShell(name as keyof typeof cases);
    t.after(shell.remove);
    for (const side of shell.sides) {
      const sections = catalogueNavSections(side.catalogue);
      const parent = leaf(
        sections.flatMap(({ children }) => children),
        expected.parent,
      );
      assert.deepEqual(
        parent?.variants?.map(({ entryId, removedVariant }) => [
          entryId,
          removedVariant === true,
        ]),
        expected.variants,
        side.name,
      );
      assert.equal(
        sections
          .flatMap(({ children }) => children)
          .some((node) => node.key === `removed:${expected.removed}`),
        false,
        `${side.name}: no flat fallback row`,
      );
    }
  });

  test(`${name}: a container row reaches the removed sibling in Changes`, async (t) => {
    const shell = await branchPointShell(name as keyof typeof cases);
    t.after(shell.remove);
    for (const side of shell.sides) {
      const container = side.catalogue.byPath.get(expected.container)!;
      const removed = side.catalogue.removedEntries.find(
        ({ entry }) => entry.path === expected.removed,
      )!;
      const selection = {
        ...defaultSelection,
        view: "changes" as const,
        search: "secondary",
      };
      const route = changesActivation(
        side.catalogue,
        side.context(undefined, selection),
        selection,
        { view: { kind: "target", target: toRouteTarget(container) } },
      );
      assert.equal(
        route.view.kind === "target" ? route.view.target.entry.path : undefined,
        expected.removed,
        side.name,
      );
      assert.equal(route.snapshot, removed.snapshotId, side.name);
    }
  });

  test(`${name}: the removed sibling's crumbs and details name its parent`, async (t) => {
    const shell = await branchPointShell(name as keyof typeof cases);
    t.after(shell.remove);
    for (const side of shell.sides) {
      const entry = routedEntry(side, expected.removed);
      const head = targetHead(side.catalogue, toRouteTarget(entry));
      assert.deepEqual(head.crumbs, expected.crumbs, side.name);
      assert.equal(head.title, expected.heading, side.name);
      const details = renderToStaticMarkup(
        createElement(EntryDetailsBody, { catalogue: side.catalogue, entry }),
      );
      assert.match(
        details,
        new RegExp(`Variant of.*href="${expected.crumbs[1].href}"`),
        side.name,
      );
    }
  });
}

test("a removed variant whose parent path now names a document shows its stored title", async (t) => {
  const shell = await branchPointShell("reused-parent");
  t.after(shell.remove);
  for (const side of shell.sides) {
    const entry = routedEntry(side, "library/action/default");
    assert.deepEqual(
      targetHead(side.catalogue, toRouteTarget(entry)),
      {
        crumbs: [{ label: "Library" }, { label: "Action" }],
        path: "library/action/default",
        title: "Default",
      },
      side.name,
    );
    const sections = catalogueNavSections(side.catalogue);
    assert.equal(
      leaf(
        sections.flatMap(({ children }) => children),
        "library/action",
      )?.variants,
      undefined,
      `${side.name}: the document never adopts the removed variant`,
    );
    assert.doesNotMatch(
      renderToStaticMarkup(
        createElement(EntryDetailsBody, { catalogue: side.catalogue, entry }),
      ),
      /Variant of/,
      side.name,
    );
  }
});
