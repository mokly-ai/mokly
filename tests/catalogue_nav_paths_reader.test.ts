import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { readCatalogue } from "../packages/viewer/src/catalogue/reader.js";
import type { CatalogueReadModel } from "../packages/viewer/src/catalogue/types.js";

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;
type Fixture = Mutable<CatalogueReadModel>;
type Node = Fixture["tree"][number];
const homePath = "product/browse/home";
const variantPath = `${homePath}/empty`;

async function fixture(): Promise<Fixture> {
  return JSON.parse(
    await readFile("docs/protocol/fixtures/catalogue-v4.json", "utf8"),
  ) as Fixture;
}
function find(nodes: readonly Node[], path: string): Node {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const nested = findOptional(node.children, path);
      if (nested) return nested;
    }
  }
  throw new Error(`fixture node ${path} is missing`);
}
function findOptional(nodes: readonly Node[], path: string): Node | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    const nested = findOptional(node.children ?? [], path);
    if (nested) return nested;
  }
  return undefined;
}

const invalid: readonly { name: string; mutate(value: Fixture): void }[] = [
  {
    name: "case-conflicting folder paths",
    mutate(value) {
      const node = find(value.tree, "components");
      value.tree.push({ ...structuredClone(node), path: "Components" });
    },
  },
  ...["", "bad label", "with.dot", "../outside", "aux"].map((path) => ({
    name: `invalid folder path ${JSON.stringify(path)}`,
    mutate(value: Fixture) {
      find(value.tree, "product").path = path;
    },
  })),
  {
    name: "an empty folder",
    mutate(value) {
      find(value.tree, "product").children = [];
    },
  },
  {
    name: "an unknown entry",
    mutate(value) {
      find(value.tree, "guide").path = "missing";
    },
  },
  {
    name: "a duplicated entry",
    mutate(value) {
      value.tree.push({ kind: "entry", path: "guide" });
    },
  },
  {
    name: "an entry in the wrong folder",
    mutate(value) {
      find(value.tree, "product").children!.push({
        kind: "entry",
        path: "guide",
      });
    },
  },
  {
    name: "a historical entry in the current tree",
    mutate(value) {
      value.tree.push({
        kind: "entry",
        path: value.removedEntries[0]!.entry.path,
      });
    },
  },
  {
    name: "an index that is not the folder's own first child",
    mutate(value) {
      const node = find(value.tree, "product");
      if (node.kind === "folder") node.index = "guide";
    },
  },
  {
    name: "a variant outside its parent",
    mutate(value) {
      find(value.tree, homePath).children = [];
      value.tree.push({ kind: "entry", path: variantPath });
    },
  },
  {
    name: "missing authored variants under a visible parent",
    mutate(value) {
      find(value.tree, homePath).children = [];
    },
  },
  {
    name: "removed Changes on a current entry",
    mutate(value) {
      value.screens[0]!.changes = {
        status: "ready",
        kind: "removed",
        included: true,
      };
    },
  },
  {
    name: "empty children on a page entry",
    mutate(value) {
      find(value.tree, "guide").children = [];
    },
  },
  {
    name: "missing historical folder titles",
    mutate(value) {
      Reflect.deleteProperty(value.removedEntries[0]!, "folderTitles");
    },
  },
];
for (const { name, mutate } of invalid)
  test(`read model v4 rejects ${name}`, async () => {
    const value = await fixture();
    mutate(value);
    assert.throws(() => readCatalogue(value));
  });

test("display titles may match folder titles and explicit tree order is authoritative", async () => {
  const value = await fixture();
  value.pages[0]!.title = "Product";
  value.tree.reverse();
  assert.deepEqual(readCatalogue(value).tree, value.tree);
});

test("variant paths must remain directly below their parent", async () => {
  const value = await fixture();
  const variant = value.screens.find((entry) => entry.path === variantPath)!;
  variant.path = "examples/empty";
  find(value.tree, variantPath).path = variant.path;
  assert.throws(
    () => readCatalogue(value),
    /variant path must be parent path plus one segment/,
  );
});

test("hidden folders retain their entries in the tree", async () => {
  const value = await fixture();
  for (const node of value.tree) Object.assign(node, { hidden: true });
  const parsed = readCatalogue(value);
  assert.equal(parsed.screens.length, value.screens.length);
  assert.deepEqual(parsed.tree, value.tree);
});
