import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { readCatalogue } from "../packages/viewer/src/catalogue/reader.js";
import type { CatalogueReadModel } from "../packages/viewer/src/catalogue/types.js";
import { ComponentValidationError } from "../packages/viewer/src/components/data.js";

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

const invalid: readonly {
  name: string;
  reason: string;
  mutate(value: Fixture): void;
}[] = [
  {
    name: "case-conflicting folder paths",
    reason: "duplicate tree folder",
    mutate(value) {
      const node = find(value.tree, "components");
      value.tree.push({ ...structuredClone(node), path: "Components" });
    },
  },
  ...["", "bad label", "with.dot", "../outside", "aux"].map((path) => ({
    name: `invalid folder path ${JSON.stringify(path)}`,
    reason:
      path === ""
        ? "expected nonempty text"
        : path === "../outside"
          ? "expected repository-relative path"
          : "invalid entry path",
    mutate(value: Fixture) {
      find(value.tree, "product").path = path;
    },
  })),
  {
    name: "an empty folder",
    reason: "tree folder cannot be empty",
    mutate(value) {
      find(value.tree, "product").children = [];
    },
  },
  {
    name: "an unknown entry",
    reason: "tree entry must name one unique current entry",
    mutate(value) {
      find(value.tree, "guide").path = "missing";
    },
  },
  {
    name: "a duplicated entry",
    reason: "tree entry must name one unique current entry",
    mutate(value) {
      value.tree.push({ kind: "entry", path: "guide" });
    },
  },
  {
    name: "an entry in the wrong folder",
    reason: "tree child must be below its parent path",
    mutate(value) {
      find(value.tree, "product").children!.push({
        kind: "entry",
        path: "guide",
      });
    },
  },
  {
    name: "a historical entry in the current tree",
    reason: "tree entry must name one unique current entry",
    mutate(value) {
      find(value.tree, "product").children!.push({
        kind: "entry",
        path: value.removedEntries[0]!.entry.path,
      });
    },
  },
  {
    name: "an index that is not the folder's own first child",
    reason: "folder index must be its first child page",
    mutate(value) {
      const node = find(value.tree, "product");
      if (node.kind === "folder") node.index = "guide";
    },
  },
  {
    name: "a variant outside its parent",
    reason: "variant must be below its parent entry",
    mutate(value) {
      Object.assign(find(value.tree, homePath), {
        kind: "folder",
        title: "Home",
      });
    },
  },
  {
    name: "missing authored variants under a visible parent",
    reason: "tree variants must retain authored order",
    mutate(value) {
      Reflect.deleteProperty(find(value.tree, homePath), "children");
    },
  },
  {
    name: "a variant with children",
    reason: "variant cannot have children",
    mutate(value) {
      find(value.tree, variantPath).children = [];
    },
  },
  {
    name: "variants outside authored order",
    reason: "tree variants must retain authored order",
    mutate(value) {
      const second = structuredClone(
        value.screens.find((entry) => entry.path === variantPath)!,
      );
      second.path = `${homePath}/second`;
      value.screens.push(second);
      find(value.tree, homePath).children!.push({
        kind: "entry",
        path: second.path,
      });
      assert.doesNotThrow(() => readCatalogue(value));
      find(value.tree, homePath).children!.reverse();
    },
  },
  {
    name: "a current entry missing from the tree",
    reason: "tree must contain every current entry",
    mutate(value) {
      value.tree = value.tree.filter((node) => node.path !== "guide");
    },
  },
  {
    name: "removed Changes on a current entry",
    reason: "current entry cannot have removed Changes",
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
    reason: "only grouped screen and component entries have children",
    mutate(value) {
      find(value.tree, "guide").children = [];
    },
  },
  {
    name: "missing historical folder titles",
    reason: "expected an array",
    mutate(value) {
      Reflect.deleteProperty(value.removedEntries[0]!, "folderTitles");
    },
  },
];
for (const { name, reason, mutate } of invalid)
  test(`read model v4 rejects ${name}`, async () => {
    const value = await fixture();
    mutate(value);
    assert.throws(() => readCatalogue(value), catalogueError(reason));
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
    catalogueError("variant path must be parent path plus one segment"),
  );
});

test("hidden folders retain their entries in the tree", async () => {
  const value = await fixture();
  for (const node of value.tree) Object.assign(node, { hidden: true });
  const parsed = readCatalogue(value);
  assert.equal(parsed.screens.length, value.screens.length);
  assert.deepEqual(parsed.tree, value.tree);
});

function catalogueError(reason: string): (error: unknown) => boolean {
  return (error) => {
    assert.ok(error instanceof ComponentValidationError);
    assert.equal(error.path, "$catalogue");
    assert.equal(error.detail, reason);
    assert.equal(error.message, `[mokly/components] $catalogue: ${reason}`);
    return true;
  };
}
