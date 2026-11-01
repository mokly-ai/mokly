import assert from "node:assert/strict";
import test from "node:test";

import {
  treeRecord as entry,
  entryNode as e,
  folderNode as f,
  treeHierarchy,
} from "../packages/viewer/tests/tree_fixture.js";

test("one path tree splits mixed folders by kind and retains authored variants", () => {
  const entries = [
    entry("design/browse/a", "screen", "Alpha"),
    entry("design/z", "screen", "Zed"),
    entry("design/button", "component", "Button"),
    entry("design/browse/b", "page", "Beta"),
    entry("design/browse/a/second", "screen", "Second", {
      variantOf: "design/browse/a",
    }),
    entry("design/browse/a/first", "screen", "First", {
      variantOf: "design/browse/a",
    }),
  ];
  const hierarchy = treeHierarchy(entries, [
    f("design", "Design", [
      f("design/browse", "Browse", [
        e("design/browse/a", [
          e("design/browse/a/second"),
          e("design/browse/a/first"),
        ]),
        e("design/browse/b"),
      ]),
      e("design/button"),
      e("design/z"),
    ]),
  ]);
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
  const full = hierarchy.tree;
  assert.equal(full[0]?.children?.length, 3);
});

test("display labels may repeat without changing paths or causing identity conflicts", () => {
  const entries = [
    entry("one/a", "page", "Settings"),
    entry("two/a", "page", "Settings"),
    entry("settings/b", "page", "Nested"),
  ];
  const hierarchy = treeHierarchy(entries, [
    f("one", "The same title", [e("one/a")]),
    f("two", "The same title", [e("two/a")]),
    f("settings", "Settings", [e("settings/b")]),
  ]);
  assert.deepEqual(
    hierarchy.roots.specs.map((node) => node.key),
    ["settings", "one", "two"],
  );
  assert.equal(hierarchy.byPath.size, 3);
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
    const folder = treeHierarchy(entries, [
      f(
        "group",
        "Group",
        [
          f("group/sub", "Sub", [e("group/sub/item")]),
          e("group/a"),
          e("group/b"),
        ],
        { order: [...order] },
      ),
    ]).roots.specs[0];
    assert.deepEqual(
      folder?.children?.map((node) => node.key),
      expected,
    );
  }
});
