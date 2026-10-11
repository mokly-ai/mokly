import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";
import { compareReview } from "../dist/review/compare.js";
import { RepositorySelectedReview } from "../dist/review/selected.js";

import { changedFixture, retainedChanges } from "./helpers/changed_fixture.js";
import { committedReviewRepository } from "./helpers/committed_repository.js";
import { validEntrySource } from "./helpers/fixture.js";

test("verified head deletion never authorizes missing required snapshot or export bytes", async (t) => {
  const fixture = await changedFixture(
    t,
    validEntrySource({
      body: '<link rel="stylesheet" href="../../theme.css"/><p>Styled</p>',
    }),
    undefined,
    async ({ mockupsDir }) => {
      await fs.writeFile(path.join(mockupsDir, "theme.css"), "p{color:purple}");
    },
  );
  await fs.unlink(path.join(fixture.mockupsDir, "theme.css"));
  const live = await retainedChanges(fixture);
  assert.ok(live.changedEntries.includes("home"));
  const source = live.componentChanges;
  assert.ok(source?.result);
  assert.ok(source.comparison);
  const repository = committedReviewRepository(fixture.config);
  await assert.rejects(
    compareReview(fixture.compilation, fixture.config, repository, "HEAD"),
    { code: "review-invalid" },
  );
  await assert.rejects(
    new RepositorySelectedReview(fixture.config, repository.reader).generate(
      {
        ...source.comparison,
        before: source.baseline,
        after: fixture.compilation.manifest,
        result: source.result,
      },
      { path: "home" },
      new AbortController().signal,
    ),
    /Snapshot file is missing.*theme\.css/,
  );
  await assert.rejects(
    exportCatalogue(
      fixture.config,
      { outDir: path.join(fixture.root, "site"), noChanges: true },
      { compile: async () => fixture.compilation },
    ),
    /theme\.css/,
  );
  await assert.rejects(fs.stat(path.join(fixture.root, "site")), {
    code: "ENOENT",
  });
});
