import assert from "node:assert/strict";
import test from "node:test";

import { ExportInventory } from "../packages/mokly/dist/export/inventory.js";
import { validateExportReferences } from "../packages/mokly/dist/export/references.js";

const collisions = [
  { label: "exact alias/file", files: ["view/home"], aliases: ["view/home"] },
  {
    label: "case-folded alias/file",
    files: ["VIEW/HOME"],
    aliases: ["view/home"],
  },
  {
    label: "alias/directory",
    files: ["view/home/child.html"],
    aliases: ["view/home"],
  },
  {
    label: "file/alias descendant",
    files: ["view/home"],
    aliases: ["view/home/child"],
  },
  {
    label: "case-folded alias/directory",
    files: ["VIEW/HOME/child.html"],
    aliases: ["view/home"],
  },
  {
    label: "case-folded alias/alias",
    files: [],
    aliases: ["view/home", "VIEW/HOME"],
  },
  {
    label: "alias/alias prefix",
    files: [],
    aliases: ["view/home", "view/home/child"],
  },
  {
    label: "case-folded alias/alias prefix",
    files: [],
    aliases: ["VIEW/HOME", "view/home/child"],
  },
];

for (const { label, files, aliases } of collisions) {
  test(`hosting aliases reject ${label} collisions in either insertion order`, () => {
    for (const names of [aliases, [...aliases].reverse()]) {
      const inventory = new ExportInventory();
      for (const name of ["target.html", ...files])
        inventory.add(name, "<p>Shared content</p>");
      assert.throws(
        () =>
          validateExportReferences(
            inventory.files,
            new Map(names.map((name) => [name, "target.html"])),
          ),
        /collision|Invalid hosting alias/,
      );
    }
  });
}

test("distinct sibling aliases may share a target without changing file ownership", () => {
  const files = new Map([
    [
      "index.html",
      '<a href="/view/home#title">Home</a><a href="/view/home-more#title">More</a>',
    ],
    ["view/home.html", '<h1 id="title">Home</h1>'],
    ["view/home-more-files/details.html", "Details"],
  ]);
  const aliases = new Map([
    ["view/home", "view/home.html"],
    ["view/home-more", "view/home.html"],
  ]);
  const previous = new Map(files);
  validateExportReferences(files, aliases);
  assert.deepEqual(files, previous);
});

test("file deduplication does not relax case or prefix collision checks", () => {
  const inventory = new ExportInventory();
  inventory.add("view/home.html", "Home");
  inventory.add("view/home.html", Buffer.from("Home"));
  assert.equal(inventory.files.size, 1);
  for (const name of ["VIEW/HOME.html", "view/home.html/child", "VIEW"])
    assert.throws(() => inventory.add(name, "Home"), /collision/);
  assert.throws(
    () => inventory.add("view/home.html", "Different"),
    /collision/,
  );
});
