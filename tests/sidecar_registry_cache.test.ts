import assert from "node:assert/strict";
import test from "node:test";

import { emotionOwners } from "../packages/mokly/src/sidecar/emotion-ownership.js";
import type { EmotionCache } from "../packages/mokly/src/sidecar/emotion-ownership.js";
import { styledOwners } from "../packages/mokly/src/sidecar/styled-ownership.js";

for (const order of [
  ["supplier", "receiver"],
  ["receiver", "supplier"],
]) {
  test(`styled cache hits keep both owners in ${order.join("/")} order`, () => {
    const names = new Set<string>();
    const delivered: string[] = [];
    const root = {
      hasNameForId: (id: string, name: string) => names.has(id + name),
      insertRules(id: string, name: string, rules: string[]) {
        names.add(id + name);
        delivered.push(...rules);
      },
    };
    const capture = styledOwners(root, undefined);
    for (const owner of order) {
      const view = capture.forOwner(owner);
      if (!view.hasNameForId("shared", "hash"))
        view.insertRules("shared", "hash", [".hash{color:red}"]);
    }
    assert.deepEqual(delivered, [".hash{color:red}"]);
    assert.deepEqual(capture.records(), [
      { css: ".hash{color:red}", owners: ["receiver"] },
      { css: ".hash{color:red}", owners: ["supplier"] },
    ]);
  });

  test(`Emotion cache hits keep both owners in ${order.join("/")} order`, () => {
    const delivered: string[] = [];
    const cache: EmotionCache = {
      inserted: {},
      insert(_selector, serialized) {
        cache.inserted[serialized.name] = serialized.styles;
        delivered.push(serialized.styles);
      },
    };
    const capture = emotionOwners(cache);
    for (const owner of order) {
      const view = capture.forOwner(owner);
      if (view.inserted.hash === undefined)
        view.insert(
          ".hash",
          { name: "hash", styles: ".hash{color:red}" },
          {},
          true,
        );
    }
    assert.deepEqual(delivered, [".hash{color:red}"]);
    assert.deepEqual(capture.records(["hash"]), [
      { css: ".hash{color:red}", owners: ["receiver"] },
      { css: ".hash{color:red}", owners: ["supplier"] },
    ]);
    assert.deepEqual(capture.records([]), []);
  });
}

test("equal selectors with different rules retain adapter identity", () => {
  const root = { hasNameForId: () => false, insertRules() {} };
  const capture = styledOwners(root, undefined);
  capture.forOwner("later").insertRules("second", "b", [".same{color:blue}"]);
  capture.forOwner("earlier").insertRules("first", "a", [".same{color:red}"]);
  assert.deepEqual(capture.records(), [
    { css: ".same{color:blue}", owners: ["later"] },
    { css: ".same{color:red}", owners: ["earlier"] },
  ]);
});
