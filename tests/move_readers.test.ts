import assert from "node:assert/strict";
import test from "node:test";

import { readCatalogue, type CatalogueReadModel } from "@mokly/viewer";
import { parseReviewResult } from "@mokly/viewer/data";
import { createCatalogue } from "@mokly/viewer/server";

import { projectCatalogue } from "../packages/mokly/dist/catalogue/projection.js";
import { compareReview } from "../packages/mokly/dist/review/compare.js";
import { computeCatalogueChanges } from "../packages/mokly/dist/server/changed.js";

import { movedCatalogueFixture } from "./helpers/move_catalogue.js";

test("the public reader rejects impossible previous paths and hidden pure moves", async (t) => {
  const fixture = await movedCatalogueFixture(t);
  const changes = await computeCatalogueChanges(
    fixture.config,
    "main",
    fixture.git,
    fixture.after.manifest,
  );
  const model = projectCatalogue({
    catalogue: createCatalogue(fixture.after.manifest),
    configPath: "mokly.config.ts",
    changesStatus: "ready",
    comparisonUrl: null,
    changedEntries: changes.changedEntries,
    evidence: changes.componentChanges,
    revision: { content: 0, evidence: 0 },
  });
  const cases: readonly [(model: CatalogueReadModel) => void, string][] = [
    [
      (value) => {
        value.documents[0]!.previousPath = value.documents[0]!.path;
      },
      "previousPath must name a different identity",
    ],
    [
      (value) => {
        value.documents[0]!.previousPath =
          value.documents[0]!.path.toUpperCase();
      },
      "previousPath must name a different identity",
    ],
    [
      (value) => {
        value.documents[0]!.changes = {
          status: "ready",
          kind: "added",
          included: true,
        };
      },
      "moved entry needs included changed or unmodified Changes",
    ],
    [
      (value) => {
        value.documents[0]!.changes = {
          status: "ready",
          kind: "unmodified",
          included: false,
        };
      },
      "moved entry needs included changed or unmodified Changes",
    ],
    [
      (value) => {
        value.documents[1]!.previousPath = value.documents[0]!.previousPath!;
      },
      "previous paths must be unique",
    ],
    [
      (value) => {
        const entry = structuredClone(value.documents[0]!);
        entry.path = entry.previousPath!;
        delete entry.previousPath;
        entry.changes = { status: "ready", kind: "removed", included: true };
        value.removedEntries = [{ entry, folderTitles: [] }];
      },
      "paired previous path cannot be removed",
    ],
  ];
  assert.deepEqual(readCatalogue(model), model);
  for (const [mutate, detail] of cases) {
    const changed = structuredClone(model);
    mutate(changed);
    assert.throws(() => readCatalogue(changed), { detail });
  }
});

test("the review reader rejects duplicate pairings and simultaneous removed records", async (t) => {
  const fixture = await movedCatalogueFixture(t);
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  const duplicate = structuredClone(result);
  duplicate.screens[1]!.before!.path = duplicate.screens[0]!.before!.path;
  duplicate.screens[1]!.previousPath = duplicate.screens[0]!.previousPath!;
  const change = duplicate.changes.find(
    (entry) => entry.after?.path === duplicate.screens[1]!.path,
  )!;
  change.before!.path = duplicate.screens[1]!.before!.path;
  change.previousPath = duplicate.screens[1]!.previousPath!;
  assert.throws(() => parseReviewResult(duplicate), {
    message: "[mokly/review] [mokly/review] previous paths must be unique",
  });
  const removed = structuredClone(result);
  const screen = structuredClone(removed.screens[0]!);
  screen.path = screen.previousPath!;
  screen.title = screen.before!.title;
  delete screen.previousPath;
  delete screen.after;
  screen.state = "removed";
  screen.views = screen.views.map((view) => ({ ...view, state: "removed" }));
  removed.screens = [...removed.screens, screen].sort((a, b) =>
    a.path < b.path ? -1 : 1,
  );
  assert.throws(() => parseReviewResult(removed), {
    message:
      "[mokly/review] [mokly/review] paired previous path cannot be removed",
  });
});
