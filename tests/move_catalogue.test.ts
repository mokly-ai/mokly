import assert from "node:assert/strict";
import test from "node:test";

import { readCatalogue } from "@mokly/viewer";
import { createCatalogue } from "@mokly/viewer/server";

import { projectCatalogue } from "../packages/mokly/dist/catalogue/projection.js";
import { summaryMarkdown } from "../packages/mokly/dist/review/artifact.js";
import { compareReview } from "../packages/mokly/dist/review/compare.js";
import { computeCatalogueChanges } from "../packages/mokly/dist/server/changed.js";

import { movedCatalogueFixture } from "./helpers/move_catalogue.js";

for (const edited of [false, true])
  test(`a directory move shares pairs, membership and material kinds across all entry kinds: edited=${edited}`, async (t) => {
    const fixture = await movedCatalogueFixture(t, { edited });
    const changes = await computeCatalogueChanges(
      fixture.config,
      "main",
      fixture.git,
      fixture.after.manifest,
    );
    const expected = [
      "new",
      "new/guide",
      "new/page",
      "new/screen",
      "new/screen/detail",
    ];
    assert.deepEqual(
      changes.movedEntries,
      expected.map((path) => ({
        path,
        previousPath: path.replace(/^new/, "old"),
      })),
    );
    assert.deepEqual(changes.changedEntries, expected);
    assert.deepEqual(changes.removedEntries, []);
    const model = projectCatalogue({
      catalogue: createCatalogue(
        fixture.after.manifest,
        changes.removedEntries,
      ),
      configPath: "mokly.config.ts",
      changesStatus: "ready",
      comparisonUrl: null,
      revision: { content: 0, evidence: 0 },
      changedEntries: changes.changedEntries,
      evidence: changes.componentChanges,
    });
    assert.deepEqual(readCatalogue(model), model);
    for (const entry of [
      ...model.documents,
      ...model.pages,
      ...model.screens,
    ]) {
      assert.equal(entry.previousPath, entry.path.replace(/^new/, "old"));
      assert.deepEqual(entry.changes, {
        status: "ready",
        included: true,
        kind: edited && entry.path === "new/guide" ? "changed" : "unmodified",
      });
    }
    assert.deepEqual(model.removedEntries, []);
    const artifact = await compareReview(
      fixture.after,
      fixture.config,
      fixture.git,
      "main",
    );
    assert.deepEqual(
      artifact.pairing?.moves.map(({ path, previousPath }) => ({
        path,
        previousPath,
      })),
      changes.movedEntries,
    );
    assert.match(
      summaryMarkdown(artifact.result, artifact.pairing),
      /moved: 5/,
    );
    assert.match(
      summaryMarkdown(artifact.result, artifact.pairing),
      /output changes: 0/,
    );
  });

test("a document resource moved with its directory keeps byte-identical material unmodified", async (t) => {
  const fixture = await movedCatalogueFixture(t, { resource: true });
  const changes = await computeCatalogueChanges(
    fixture.config,
    "main",
    fixture.git,
    fixture.after.manifest,
  );
  assert.ok(changes.movedEntries.some((move) => move.path === "new/guide"));
  assert.ok(!changes.componentChanges?.changedEntries?.includes("new/guide"));
});
