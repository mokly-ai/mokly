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
  assert.deepEqual(changes.changedRoutes, [
    "screens/home.html",
    "user-flows/tour.html",
  ]);
  const snapshot = changes.componentChanges!;
  assert.ok(snapshot.comparison);
  assert.ok(snapshot.comparison.headOutputs);
  const { compileCatalogue } = await import("../dist/build/compile.js");
  const current = await compileCatalogue(fixture.config);
  await fs.mkdir(path.join(fixture.mockupsDir, "screens"), { recursive: true });
  await fs.writeFile(
    path.join(fixture.mockupsDir, "screens/home.mobile.html"),
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
    },
    { route: "screens/home.html" },
    new AbortController().signal,
  );
  assert.match(
    String(comparison.files.get("snapshots/after/screens/home.mobile.html")),
    /Source-only change/,
  );
  assert.doesNotMatch(
    String(comparison.files.get("snapshots/before/screens/home.mobile.html")),
    /Source-only change/,
  );
});
