import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { readBranchPointPath } from "../packages/viewer/src/catalogue/path_values.js";
import {
  readCatalogue,
  readShellCatalogue,
} from "../packages/viewer/src/catalogue/reader.js";
import type { CatalogueReadModel } from "../packages/viewer/src/catalogue/types.js";
import { parseReviewResult } from "../packages/viewer/src/review/result_validation.js";

function catalogue(): CatalogueReadModel {
  return JSON.parse(
    fs.readFileSync(
      new URL("../docs/protocol/fixtures/catalogue-v4.json", import.meta.url),
      "utf8",
    ),
  );
}

for (const reader of [readCatalogue, readShellCatalogue]) {
  for (const folded of [false, true])
    test(`${reader.name} rejects a previous path used by a current entry of the same kind (${folded})`, () => {
      const model = catalogue();
      const [first, second] = model.screens;
      assert.ok(first && second);
      second.previousPath = readBranchPointPath(
        folded ? first.path.toUpperCase() : first.path,
      );
      second.changes = { status: "ready", kind: "changed", included: true };
      assert.throws(() => reader(model), {
        detail: "previousPath cannot name a current entry of the same kind",
      });
    });

  test(`${reader.name} accepts a previous path used by a different kind`, () => {
    const model = catalogue();
    model.screens[0]!.previousPath = readBranchPointPath(model.pages[0]!.path);
    model.screens[0]!.changes = {
      status: "ready",
      kind: "changed",
      included: true,
    };
    assert.deepEqual(reader(model), model);
  });
}

function review(previousPath: string, kind: "screen" | "use-case") {
  const address = { path: "target", title: "Target" };
  const before = { path: previousPath, title: "Before" };
  const screen = (path: string) => ({
    path,
    title: path,
    before: { path, title: path },
    after: { path, title: path },
    dependencies: [],
    sharedImpact: [],
    state: "unchanged",
    views: [
      {
        viewport: "mobile",
        colorScheme: "light",
        ignoredIds: [],
        state: "unchanged",
      },
    ],
  });
  return {
    schemaVersion: 5,
    baseCommit: "a".repeat(40),
    baseRef: "main",
    changedPaths: [],
    sharedImpact: [],
    ignoredImpact: [],
    components: [],
    affectedConsumers: [],
    screens:
      kind === "screen"
        ? [
            screen("existing"),
            {
              ...screen("target"),
              before,
              after: address,
              title: address.title,
              previousPath,
            },
          ]
        : [screen("existing")],
    changes: [{ kind, before, after: address, previousPath, reasons: [] }],
  };
}

for (const path of ["existing", "EXISTING"])
  test(`the review reader rejects a current same-kind previous path (${path}) before references`, () => {
    const value = review(path, "screen");
    assert.throws(
      () => parseReviewResult(value),
      /previousPath cannot name a current entry of the same kind/,
    );
    const invalidReferences = {
      ...value,
      affectedConsumers: [
        {
          changedComponentId: "missing",
          consumer: { kind: "screen", path: "target" },
          evidence: [
            {
              side: "before",
              context: {
                kind: "screen",
                entry: { path, title: "Before" },
                viewport: "mobile",
                colorScheme: "light",
              },
              via: [{ componentId: "missing", instanceKey: "a".repeat(64) }],
            },
          ],
        },
      ],
    };
    assert.throws(
      () => parseReviewResult(invalidReferences),
      /previousPath cannot name a current entry of the same kind/,
    );
  });

test("the review reader accepts a previous path used by a different kind", () => {
  const value = review("EXISTING", "use-case");
  assert.deepEqual(parseReviewResult(value), value);
});
