import assert from "node:assert/strict";
import test from "node:test";

import { readBranchPointPath } from "../packages/viewer/src/catalogue/path_values.js";
import {
  readCatalogue,
  readShellCatalogue,
} from "../packages/viewer/src/catalogue/reader.js";
import { projectScopedCatalogue } from "../packages/viewer/src/catalogue/scoped_projection.js";
import type { CatalogueView } from "../packages/viewer/src/catalogue/types.js";
import { resolveCatalogueUsageScope } from "../packages/viewer/src/catalogue/usage_scope.js";
import type { ComponentViewRecord } from "../packages/viewer/src/components/manifest_types.js";
import { parseReviewResult } from "../packages/viewer/src/review/result_validation.js";
import { createCatalogue } from "../packages/viewer/src/shell/catalogue.js";
import { fixtureVariantsAt } from "../packages/viewer/tests/path_fixture.js";
import { projectCatalogue } from "../src/catalogue/projection.js";
import { compareReview } from "../src/review/compare.js";
import { computeCatalogueChanges } from "../src/server/changed.js";

import { branchPointFixture } from "./helpers/branch_point_fixture.js";

for (const name of [
  "removed-screen-usage",
  "removed-variant-order",
  "new-parent-variant",
] as const)
  test(`branch-point case ${name} retains its data and scoped reader agreement`, async (t) => {
    const fixture = await branchPointFixture(name);
    t.after(fixture.fixture.remove);
    const changes = await computeCatalogueChanges(
      fixture.config,
      "main",
      fixture.git,
      fixture.after.manifest,
    );
    const catalogue = createCatalogue(
      fixture.after.manifest,
      changes.removedEntries,
      changes.movedEntries,
    );
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
    const review = await compareReview(
      fixture.after,
      fixture.config,
      fixture.git,
      "main",
    );
    assert.deepEqual(parseReviewResult(review.result), review.result);
    assert.deepEqual(review.pairing?.diagnostics, []);
    if (name === "removed-screen-usage") {
      assert.deepEqual(
        changes.movedEntries.map(({ path, previousPath }) => [
          path,
          previousPath,
        ]),
        [
          ["library/ui/badge", "library/badge"],
          ["library/ui/badge/default", "library/badge/default"],
        ],
      );
      for (const { entry } of model.removedEntries) {
        assert.equal(entry.kind, "screen");
        if (entry.kind !== "screen") continue;
        const baseline = fixture.before.manifest.entries.find(
          (item) => item.path === entry.path,
        );
        assert.ok(baseline?.kind === "screen");
        for (const view of entry.views) {
          assert.equal(view.usage.status, "ready");
          if (view.usage.status !== "ready") continue;
          const original: ComponentViewRecord = baseline.componentViews!.find(
            (item) =>
              item.viewport === view.viewport &&
              item.colorScheme === view.colorScheme,
          )!;
          assert.deepEqual(view.usage.instances, original.instances);
          assert.equal(
            view.usage.instances[0]?.componentId,
            entry.path === "shop/receipt" ? "library/badge" : "library/Pill",
          );
        }
      }
      for (const reader of [readCatalogue, readShellCatalogue]) {
        for (const name of ["missing", "library/ui/badge/default"]) {
          const invalid = structuredClone(model);
          const screen = invalid.removedEntries.find(
            ({ entry }) => entry.path === "shop/receipt",
          )!.entry;
          assert.ok(screen.kind === "screen");
          const usage = screen.views[0]!.usage;
          assert.ok(usage.status === "ready");
          usage.instances[0]!.componentId = readBranchPointPath(name);
          assert.throws(() => reader(invalid), {
            detail: "instance names an unknown component",
          });
        }
      }
    }
    if (name === "removed-variant-order") {
      assert.deepEqual(
        model.removedEntries.map(({ entry }) => entry.path),
        [
          "library/action/zulu",
          "library/action/alpha",
          "library/Choice/zulu",
          "library/Choice/alpha",
        ],
      );
      assert.deepEqual(
        model.removedEntries.map(({ parentTitle }) => parentTitle),
        ["Action", "Action", "Choice", "Choice"],
      );
      for (const [parent, before] of [
        ["library/archive/action", "library/action"],
        ["library/choice", "library/Choice"],
      ]) {
        const paths = [
          `${parent}/default`,
          `${before}/zulu`,
          `${before}/alpha`,
        ];
        assert.deepEqual(
          fixtureVariantsAt(model, parent!).map(({ path }) => path),
          paths,
        );
        assert.deepEqual(
          fixtureVariantsAt(model, before!).map(({ path }) => path),
          paths,
        );
      }
    }
    if (name === "new-parent-variant") {
      assert.deepEqual(changes.movedEntries, [
        {
          path: "library/receiver/primary",
          previousPath: "library/donor/primary",
        },
      ]);
      assert.equal(
        model.components.find((entry) => entry.path === "library/receiver")
          ?.previousPath,
        undefined,
      );
    }
    for (const entry of [
      ...model.components,
      ...model.removedEntries.map(({ entry }) => entry),
    ]) {
      const target = {
        kind: "target",
        entryPath: entry.path,
        entryKind: entry.kind,
      } as const;
      assert.deepEqual(
        readShellCatalogue(projectScopedCatalogue(model, target)),
        projectScopedCatalogue(model, target),
      );
      if (entry.kind === "component" && "variantOf" in entry) {
        const parent =
          name === "removed-variant-order"
            ? entry.path.includes("Choice") || entry.path.includes("choice")
              ? "library/choice"
              : "library/archive/action"
            : entry.variantOf;
        const variants = fixtureVariantsAt(model, parent);
        assert.deepEqual(
          [...resolveCatalogueUsageScope(model, target)],
          variants.flatMap<CatalogueView<string>>((variant) => variant.views),
        );
      }
    }
  });
