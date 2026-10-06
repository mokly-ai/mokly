import assert from "node:assert/strict";
import test from "node:test";

import { readCatalogue } from "@mokly/viewer";

import { projectCatalogue } from "../packages/mokly/src/catalogue/projection.js";
import { compareReview } from "../packages/mokly/src/review/compare.js";
import { computeCatalogueChanges } from "../packages/mokly/src/server/changed.js";
import { currentCatalogueEntries } from "../packages/viewer/src/catalogue/entry_selection.js";
import { readShellCatalogue } from "../packages/viewer/src/catalogue/reader.js";
import { projectScopedCatalogue } from "../packages/viewer/src/catalogue/scoped_projection.js";
import { createCatalogue } from "../packages/viewer/src/shell/catalogue.js";
import { branchPoints } from "../packages/viewer/src/shell/catalogue_branch_point.js";

import { branchPointFixture } from "./helpers/branch_point_fixture.js";

const cases = [
  {
    name: "moved-consumers",
    pairs: [
      ["component", "library/archive/status", "library/status"],
      ["component", "library/archive/status/default", "library/status/default"],
      ["screen", "shop/archive/receipt", "shop/receipt"],
    ],
    removed: [],
  },
  {
    name: "moved-parent",
    pairs: [
      ["component", "library/archive/action", "library/action"],
      ["component", "library/archive/action/primary", "library/action/primary"],
    ],
    removed: [["library/action/secondary", "Action"]],
  },
  {
    name: "moved-variant",
    pairs: [["component", "library/receiver/primary", "library/donor/primary"]],
    removed: [],
  },
  {
    name: "case-renames",
    pairs: [],
    removed: [["library/Action/secondary", "Action"]],
  },
  {
    name: "reused-parent",
    pairs: [],
    removed: [["library/action/default", "Action"]],
  },
] as const;

for (const expected of cases) {
  test(`branch-point fixture ${expected.name} retains pairs, removed titles and both reader shapes`, async (t) => {
    const fixture = await branchPointFixture(expected.name);
    t.after(fixture.fixture.remove);
    const { config, before, after, git } = fixture;
    const review = await compareReview(after, config, git, "main");
    assert.deepEqual(
      (review.pairing?.moves ?? []).map(({ kind, path, previousPath }) => [
        kind,
        path,
        previousPath,
      ]),
      expected.pairs,
    );
    assert.deepEqual(review.pairing?.diagnostics ?? [], []);
    const changes = await computeCatalogueChanges(
      config,
      "main",
      git,
      after.manifest,
    );
    const removed = changes.removedEntries.map(({ entry, parentTitle }) => [
      entry.path,
      parentTitle,
    ]);
    assert.deepEqual(removed, expected.removed);
    const catalogue = createCatalogue(
      after.manifest,
      changes.removedEntries,
      changes.movedEntries,
    );
    const lookup = branchPoints(catalogue);
    const baseline = before.manifest.entries;
    const model = projectCatalogue({
      catalogue,
      configPath: "mokly.config.ts",
      changesStatus: "ready",
      changedEntries: changes.changedEntries,
      evidence: changes.componentChanges,
      comparisonUrl: null,
      revision: { content: 0, evidence: 0 },
    });
    assert.deepEqual(readCatalogue(model), model);
    assert.deepEqual(readShellCatalogue(model), model);
    assert.deepEqual(
      model.removedEntries.map(({ entry, parentTitle }) => [
        entry.path,
        parentTitle,
      ]),
      expected.removed,
    );
    const current = currentCatalogueEntries(model);
    assert.deepEqual(
      current
        .filter((entry) => entry.previousPath !== undefined)
        .map(({ kind, path, previousPath }) => [kind, path, previousPath])
        .sort(),
      expected.pairs,
    );
    for (const entry of [
      ...current,
      ...model.removedEntries.map(({ entry }) => entry),
    ]) {
      const scoped = projectScopedCatalogue(model, {
        kind: "target",
        entryPath: entry.path,
        entryKind: entry.kind,
      });
      assert.deepEqual(readShellCatalogue(scoped), scoped);
    }
    for (const move of review.pairing?.moves ?? []) {
      assert.equal(
        after.manifest.entries.some(
          (entry) =>
            entry.kind === move.kind &&
            entry.path.toLowerCase() === move.previousPath.toLowerCase(),
        ),
        false,
        "a paired previous path cannot be a current same-kind path",
      );
      assert.deepEqual(lookup.counterpart(move, baseline), {
        kind: move.kind,
        path: move.previousPath,
      });
    }
    if (expected.name === "moved-consumers") {
      for (const [kind, path, previous] of [
        ["screen", "shop/archive/receipt", "shop/receipt"],
        ["component", "library/archive/status", "library/status"],
      ] as const) {
        const affected = review.result.affectedConsumers.find(
          (item) =>
            item.consumer.kind === kind &&
            item.consumer.path === path &&
            item.changedComponentId === "library/badge",
        );
        assert.ok(affected, path);
        assert.ok(
          affected.evidence.some(
            (item) =>
              item.side === "before" && item.context.entry.path === previous,
          ),
          previous,
        );
        assert.ok(
          affected.evidence.some(
            (item) => item.side === "after" && item.context.entry.path === path,
          ),
          path,
        );
        assert.equal(
          lookup.resolve({ side: "before", kind, path: previous })?.entry.path,
          path,
        );
      }
    }
    if (expected.name === "case-renames") {
      for (const [kind, path, previous] of [
        ["screen", "shop/receipt", "shop/Receipt"],
        ["component", "library/action", "library/Action"],
        ["component", "library/action/primary", "library/Action/Primary"],
      ] as const) {
        assert.deepEqual(lookup.counterpart({ kind, path }, baseline), {
          kind,
          path: previous,
        });
        assert.equal(lookup.previousPath({ kind, path }), undefined);
      }
      assert.ok(
        current.every(
          (entry) =>
            entry.changes.status === "ready" && entry.changes.kind !== "added",
        ),
      );
    }
    if (expected.name === "moved-parent" || expected.name === "case-renames") {
      const record = catalogue.removedEntries[0]!;
      const parent = lookup.parent({
        source: "removed",
        entry: record.entry,
        record,
      });
      assert.equal(parent?.source, "current");
      assert.equal(
        parent && "entry" in parent ? parent.entry.path : undefined,
        expected.name === "moved-parent"
          ? "library/archive/action"
          : "library/action",
      );
    }
    if (expected.name === "reused-parent") {
      assert.equal(
        lookup.resolve({
          side: "before",
          kind: "component",
          path: "library/action",
        }),
        undefined,
      );
      const record = catalogue.removedEntries[0]!;
      assert.deepEqual(
        lookup.parent({ source: "removed", entry: record.entry, record }),
        { source: "title", title: "Action" },
      );
      assert.equal(model.documents[0]?.path, "library/action");
    }
  });
}
