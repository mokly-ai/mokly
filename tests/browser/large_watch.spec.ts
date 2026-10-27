import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { object } from "../../packages/viewer/src/catalogue/values.js";
import { benchmark } from "../../scripts/large/benchmark.js";
import { prepareFixture } from "../../scripts/large/setup.js";
import { fixtureEdits } from "../../scripts/large/watch_edits.js";
import { repositoryRoot } from "../helpers/fixture.js";

import { test } from "./browser_test.js";

for (const variant of ["html", "react"] as const) {
  test(`large watch delivers browser evidence for ${variant}`, async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    const root = await fs.mkdtemp(
      path.join(repositoryRoot, ".context/large-watch-"),
    );
    try {
      const fixture = await prepareFixture(
        repositoryRoot,
        { areas: 1, screens: 2, rows: 1, stylesheets: 1 },
        variant,
        "workspace",
        root,
      );
      const originals = await fixtureEdits(fixture);
      const report = await benchmark(fixture, ["watch"], 1, {
        memoryStopKiB: 0,
        browser,
      });
      const result = report.results[0];
      assert.ok(result && "status" in result && result.status === "measured");
      assert.ok("edits" in result && Array.isArray(result.edits));
      const edits: unknown[] = result.edits;
      assert.deepEqual(
        edits.map((edit) => object(edit).kind),
        ["screen", "component", "stylesheet"],
      );
      for (const raw of edits) {
        const edit = object(raw);
        assert.notEqual(edit.generation, edit.previousGeneration);
        assert.ok(typeof edit.publicationRevision === "number");
        assert.ok(typeof edit.beforeRevision === "number");
        assert.ok(typeof edit.changesRevision === "number");
        assert.ok(edit.publicationRevision > edit.beforeRevision);
        assert.ok(edit.changesRevision >= edit.publicationRevision);
        assert.ok(
          typeof edit.frameNavigations === "number" &&
            edit.frameNavigations > 0,
        );
        assert.equal(object(edit.summary).baseCommit, fixture.baseline);
        for (const key of [
          "publicationMs",
          "frameReloadMs",
          "indexReadyMs",
          "changesReadyMs",
        ])
          assert.equal(typeof edit[key], "number");
      }
      for (const edit of originals)
        assert.equal(await fs.readFile(edit.file, "utf8"), edit.original);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
}
