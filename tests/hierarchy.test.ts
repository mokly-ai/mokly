import assert from "node:assert/strict";
import test from "node:test";

import { analyzeHierarchy, projectTree } from "@mokly/viewer/data";

const entry = (
  path: string,
  kind: string,
  title: string,
  variantOf?: string,
) => ({ path, kind, title, ...(variantOf ? { variantOf } : {}) });

test("one path tree splits mixed folders by kind and retains authored variants", () => {
  const entries = [
    entry("design/browse/a", "screen", "Alpha"),
    entry("design/z", "screen", "Zed"),
    entry("design/button", "component", "Button"),
    entry("design/browse/b", "page", "Beta"),
    entry("design/browse/a/second", "screen", "Second", "design/browse/a"),
    entry("design/browse/a/first", "screen", "First", "design/browse/a"),
  ];
  const { hierarchy } = analyzeHierarchy(entries);
  assert.deepEqual(hierarchy.ancestorsByPath.get("design/browse/a"), [
    "Design",
    "Browse",
  ]);
  assert.deepEqual(
    hierarchy.variantsByPath.get("design/browse/a")?.map(({ path }) => path),
    ["design/browse/a/second", "design/browse/a/first"],
  );
  assert.equal(
    hierarchy.variantParentByPath.get("design/browse/a/first"),
    entries[0],
  );
  for (const section of [hierarchy.roots.specs, hierarchy.roots.components])
    assert.equal(section[0]?.key, "design");
  const design = hierarchy.roots.specs[0];
  assert.equal(design?.kind, "folder");
  if (design?.kind !== "folder") return;
  assert.deepEqual(
    design.children.map(({ label }) => label),
    ["Browse", "Zed"],
  );
  const browse = design.children[0];
  assert.equal(browse?.kind, "folder");
  if (browse?.kind === "folder")
    assert.deepEqual(
      browse.children.map(({ label }) => label),
      ["Alpha", "Beta"],
    );
  const full = projectTree(hierarchy);
  assert.equal(full[0]?.children?.length, 3);
});

test("display labels may repeat without changing paths or causing identity conflicts", () => {
  const entries = [
    entry("one/a", "page", "Settings"),
    entry("two/a", "page", "Settings"),
    entry("settings/b", "page", "Nested"),
  ];
  const records = ["one", "two"].map((path) => ({
    path,
    title: "The same title",
    sourcePath: "specs/folders.mockup.ts",
  }));
  const hierarchy = analyzeHierarchy(entries, records).hierarchy;
  assert.deepEqual(
    hierarchy.tree.map((node) => node.key),
    ["settings", "one", "two"],
  );
  assert.equal(hierarchy.byPath.size, 3);
});

test("folder index pages are first and screen indexes retain ordinary members", () => {
  const entries = [
    entry("account", "page", "Account"),
    entry("account/invoice", "screen", "Invoice"),
    entry("account/invoice/overdue", "screen", "Overdue", "account/invoice"),
    entry("account/invoice/history/item", "page", "Item"),
  ];
  const tree = projectTree(analyzeHierarchy(entries).hierarchy);
  assert.deepEqual(tree, [
    {
      kind: "folder",
      path: "account",
      title: "Account",
      index: "account",
      children: [
        { kind: "entry", path: "account" },
        {
          kind: "entry",
          path: "account/invoice",
          children: [
            { kind: "entry", path: "account/invoice/overdue" },
            {
              kind: "folder",
              path: "account/invoice/history",
              title: "History",
              children: [
                { kind: "entry", path: "account/invoice/history/item" },
              ],
            },
          ],
        },
      ],
    },
  ]);
});

test("folder order places unnamed children at ellipsis and defaults to appending them", () => {
  const entries = [
    entry("group/a", "page", "Alpha"),
    entry("group/b", "page", "Beta"),
    entry("group/sub/item", "page", "Item"),
  ];
  for (const [order, expected] of [
    [["b"], ["group/b", "group/sub", "group/a"]],
    [
      ["b", "...", "sub"],
      ["group/b", "group/a", "group/sub"],
    ],
  ] as const) {
    const folder = analyzeHierarchy(entries, [
      { path: "group", order, sourcePath: "specs/group/_folder.json" },
    ]).hierarchy.tree[0];
    assert.deepEqual(
      folder?.children?.map((node) => node.key),
      expected,
    );
  }
});
