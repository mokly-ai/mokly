import assert from "node:assert/strict";
import { test } from "node:test";

import { screenVariants } from "../src/shell/inspect_variants.js";

import { catalogueFixture, indexFixture } from "./catalogue_v9_fixture.js";

test("a screen lists its removed variants after its current ones, and a removed variant's own page checks it", () => {
  const catalogue = catalogueFixture(indexFixture());
  const retired = catalogue.removedEntries.find(
    ({ entry }) => entry.path === "product/browse/home/retired",
  );
  assert.ok(retired);
  const home = catalogue.byPath.get("product/browse/home");
  assert.ok(home);
  const rows = (entry: typeof home) =>
    screenVariants(catalogue, entry).map(({ current, href, path }) => [
      path,
      current,
      href,
    ]);
  const snapshot = `?snapshot=${retired.snapshotId}`;
  assert.deepEqual(rows(retired.entry), [
    ["product/browse/home", false, "/view/product/browse/home/"],
    ["product/browse/home/empty", false, "/view/product/browse/home/empty/"],
    [
      "product/browse/home/retired",
      true,
      `/view/product/browse/home/retired/${snapshot}`,
    ],
  ]);
  assert.deepEqual(
    rows(home).map(([path, current]) => [path, current]),
    [
      ["product/browse/home", true],
      ["product/browse/home/empty", false],
      ["product/browse/home/retired", false],
    ],
  );
});
