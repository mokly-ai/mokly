import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";
import type { CatalogueReadModel } from "../packages/viewer/src/catalogue/types.js";

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;
type Fixture = Mutable<CatalogueReadModel>;

async function fixture(): Promise<Fixture> {
  return JSON.parse(
    await readFile("docs/protocol/fixtures/catalogue-v9.json", "utf8"),
  ) as Fixture;
}

test("display titles may match folder titles and explicit tree order is authoritative", async () => {
  const value = await fixture();
  value.pages[0]!.title = "Product";
  value.tree.reverse();
  assert.deepEqual(readCatalogueIndex(value).tree, value.tree);
});

test("hidden folders retain their entries in the tree", async () => {
  const value = await fixture();
  for (const node of value.tree) Object.assign(node, { hidden: true });
  const parsed = readCatalogueIndex(value);
  assert.equal(parsed.screens.length, value.screens.length);
  assert.deepEqual(parsed.tree, value.tree);
});
