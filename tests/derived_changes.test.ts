import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { prepareReviewRepository } from "../dist/review/prepare.js";
import { RepositorySelectedReview } from "../dist/review/selected.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";

import { derivedFixture } from "./helpers/derived_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

test("derived Changes and selected comparisons use compiled source when generated files are absent", async (t) => {
  const fixture = await derivedFixture(t);
  await fs.writeFile(
    fixture.entryPath,
    validEntrySource({ body: "Source-only change" }),
  );
  await fs.rm(fixture.mockupsDir, { recursive: true });
  const prepared = await prepareReviewRepository(fixture.config, "HEAD");
  const changes = await computeCatalogueChanges(
    fixture.config,
    "HEAD",
    prepared,
  );
  assert.deepEqual(changes.changedEntries, ["home", "tour"]);
  assert.equal(changes.schemaVersion, 3);
  assert.deepEqual(changes.movedEntries, []);
  const snapshot = changes.componentChanges!;
  assert.ok(snapshot.comparison);
  assert.ok(snapshot.comparison.headOutputs);
  const { compileCatalogue } = await import("../dist/build/compile.js");
  const current = await compileCatalogue(fixture.config);
  await fs.mkdir(path.join(fixture.generatedDir, "home"), { recursive: true });
  await fs.writeFile(
    path.join(fixture.generatedDir, "home/index.mobile.html"),
    "wrong local bytes",
  );
  const comparison = await new RepositorySelectedReview(
    fixture.config,
    prepared.reader,
  ).generate(
    {
      ...snapshot.comparison,
      before: snapshot.baseline,
      after: current.manifest,
      result: snapshot.result!,
    },
    { path: "home" },
    new AbortController().signal,
  );
  assert.match(
    String(
      comparison.files.get(
        "snapshots/after/mokly-generated/home/index.mobile.html",
      ),
    ),
    /Source-only change/,
  );
  assert.doesNotMatch(
    String(
      comparison.files.get(
        "snapshots/before/mokly-generated/home/index.mobile.html",
      ),
    ),
    /Source-only change/,
  );
});
