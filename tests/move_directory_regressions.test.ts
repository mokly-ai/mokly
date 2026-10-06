import assert from "node:assert/strict";
import test from "node:test";

import { compareReview } from "../packages/mokly/dist/review/compare.js";
import { computeCatalogueChanges } from "../packages/mokly/dist/server/changed.js";

import { movedCatalogueFixture } from "./helpers/move_catalogue.js";

test("unrelated short Markdown documents never pair through shared template lines", async (t) => {
  const fixture = await movedCatalogueFixture(t, { unrelatedDocuments: true });
  const changes = await computeCatalogueChanges(
    fixture.config,
    "main",
    fixture.git,
    fixture.after.manifest,
  );
  assert.deepEqual(changes.movedEntries, []);
  assert.deepEqual(
    changes.removedEntries.map(({ entry }) => entry.path),
    ["old/guide"],
  );
  assert.ok(changes.changedEntries?.includes("new/onboarding"));
});

for (const styles of ["configured", "imported"] as const)
  for (const destination of ["new", "new/deeper/folder"])
    for (const declared of [false, true])
      test(`stylesheet moves retain content identity: ${styles}, ${destination}, declared=${declared}`, async (t) => {
        const fixture = await movedCatalogueFixture(t, {
          styles,
          destination,
          declared,
        });
        const changes = await computeCatalogueChanges(
          fixture.config,
          "main",
          fixture.git,
          fixture.after.manifest,
        );
        assert.deepEqual(changes.removedEntries, []);
        assert.ok(
          changes.movedEntries.some(
            (move) => move.path === `${destination}/screen`,
          ),
        );
        assert.deepEqual(changes.componentChanges?.changedEntries, []);
        const { result } = await compareReview(
          fixture.after,
          fixture.config,
          fixture.git,
          "main",
        );
        assert.ok(
          result.screens.every((screen) => screen.state === "unchanged"),
        );
        assert.ok(
          result.changes.every((change) => change.reasons.length === 0),
        );
      });

test("linked screens and a separately declared flow move as one unmodified catalogue", async (t) => {
  const fixture = await movedCatalogueFixture(t, { linked: true, flow: true });
  const changes = await computeCatalogueChanges(
    fixture.config,
    "main",
    fixture.git,
    fixture.after.manifest,
  );
  assert.deepEqual(changes.removedEntries, []);
  assert.equal(
    changes.movedEntries.length,
    fixture.after.manifest.entries.length,
  );
  assert.deepEqual(changes.componentChanges?.changedEntries, []);
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.ok(result.changes.every((change) => change.reasons.length === 0));
});

test("a moved component and its users pair without authored move hints", async (t) => {
  const fixture = await movedCatalogueFixture(t, { component: true });
  const changes = await computeCatalogueChanges(
    fixture.config,
    "main",
    fixture.git,
    fixture.after.manifest,
  );
  assert.deepEqual(changes.removedEntries, []);
  assert.equal(
    changes.movedEntries.length,
    fixture.after.manifest.entries.length,
  );
  assert.deepEqual(changes.componentChanges?.changedEntries, []);
});

test("moved imported CSS retains moved image bytes and detects image edits", async (t) => {
  for (const resourceChanged of [false, true]) {
    const fixture = await movedCatalogueFixture(t, {
      styles: "imported",
      destination: "new/deeper",
      cssAsset: true,
      resourceChanged,
      declared: resourceChanged,
    });
    const changes = await computeCatalogueChanges(
      fixture.config,
      "main",
      fixture.git,
      fixture.after.manifest,
    );
    assert.deepEqual(changes.removedEntries, []);
    assert.equal(
      changes.movedEntries.length,
      fixture.after.manifest.entries.length,
    );
    assert.equal(
      changes.componentChanges?.changedEntries?.includes("new/deeper/screen"),
      resourceChanged,
    );
  }
});
